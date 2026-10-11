import { randomUUID } from "node:crypto";
import { access, readdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import ffmpegBinary from "ffmpeg-static";

const projectsDirectory = fileURLToPath(
  new URL("../src/content/projects/", import.meta.url),
);
const videoExtensions = new Set([".mp4", ".ogv", ".webm"]);
const posterExtensions = [".webp", ".avif", ".png", ".jpg", ".jpeg", ".gif"];

async function findVideos(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findVideos(entryPath)));
    } else if (entry.isFile() && videoExtensions.has(path.extname(entry.name).toLowerCase())) {
      files.push(entryPath);
    }
  }

  return files.sort();
}

async function pathExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

function getPosterPaths(videoPath) {
  const extension = path.extname(videoPath);
  const base = videoPath.slice(0, -extension.length);

  return {
    provided: posterExtensions.map((posterExtension) => `${base}-poster${posterExtension}`),
    generated: `${base}-poster.generated.webp`,
  };
}

export async function extractVideoFrame(videoPath, outputPath, ffmpegPath = ffmpegBinary) {
  if (!ffmpegPath) {
    throw new Error("FFmpeg is unavailable for this platform; install FFmpeg to generate video posters.");
  }

  const result = spawnSync(
    ffmpegPath,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-ss",
      "0",
      "-i",
      videoPath,
      "-frames:v",
      "1",
      "-vf",
      "scale=w='min(1600,iw)':h=-2",
      "-c:v",
      "libwebp",
      "-quality",
      "82",
      outputPath,
    ],
    { encoding: "utf8" },
  );

  if (result.error) {
    throw new Error(`Could not start FFmpeg: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `FFmpeg exited with status ${result.status}.`);
  }
}

export async function generateVideoPosters(
  directory = projectsDirectory,
  { ffmpegPath = ffmpegBinary, log = console.log, extractFrame = extractVideoFrame } = {},
) {
  const videos = await findVideos(directory);
  let generated = 0;
  let skipped = 0;

  for (const videoPath of videos) {
    const { provided, generated: outputPath } = getPosterPaths(videoPath);
    let hasProvidedPoster = false;

    for (const posterPath of provided) {
      if (await pathExists(posterPath)) {
        hasProvidedPoster = true;
        break;
      }
    }

    if (hasProvidedPoster) {
      log(`Using supplied poster for ${path.relative(directory, videoPath)}.`);
      skipped += 1;
      continue;
    }

    const videoInfo = await stat(videoPath);
    if (await pathExists(outputPath)) {
      const posterInfo = await stat(outputPath);
      if (posterInfo.mtimeMs >= videoInfo.mtimeMs) {
        log(`Using generated poster for ${path.relative(directory, videoPath)}.`);
        skipped += 1;
        continue;
      }
    }

    const temporaryPath = `${outputPath}.${randomUUID()}.webp`;
    try {
      await extractFrame(videoPath, temporaryPath, ffmpegPath);
      await rename(temporaryPath, outputPath);
      log(`Generated first-frame poster: ${path.relative(directory, outputPath)}.`);
      generated += 1;
    } catch (error) {
      await rm(temporaryPath, { force: true });
      throw new Error(
        `Could not generate a poster for "${videoPath}": ${error.message}`,
        { cause: error },
      );
    }
  }

  if (videos.length === 0) {
    log(`No supported video files found in ${directory}.`);
  } else {
    log(`Video poster generation complete: ${generated} generated, ${skipped} skipped.`);
  }

  return { generated, skipped };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    await generateVideoPosters();
  } catch (error) {
    console.error(`Video poster generation failed: ${error.message}`);
    process.exitCode = 1;
  }
}
