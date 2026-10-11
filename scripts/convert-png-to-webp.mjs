import { randomUUID } from "node:crypto";
import { readdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";

const projectDirectory = fileURLToPath(
  new URL("../src/content/projects/", import.meta.url),
);

async function findPngFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await findPngFiles(entryPath)));
    } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".png") {
      files.push(entryPath);
    }
  }

  return files.sort();
}

export async function convertPngsToWebp(
  directory,
  { quality = 80, overwrite = false, log = console.log } = {},
) {
  if (!Number.isInteger(quality) || quality < 1 || quality > 100) {
    throw new Error(`WebP quality must be an integer from 1 to 100; received "${quality}".`);
  }

  const directoryInfo = await stat(directory).catch((error) => {
    throw new Error(`Cannot access image directory "${directory}": ${error.message}`);
  });

  if (!directoryInfo.isDirectory()) {
    throw new Error(`Image path "${directory}" is not a directory.`);
  }

  const files = await findPngFiles(directory);
  let converted = 0;
  let skipped = 0;

  for (const inputPath of files) {
    const outputPath = `${inputPath.slice(0, -path.extname(inputPath).length)}.webp`;

    if (!overwrite) {
      try {
        await stat(outputPath);
        log(`Skipped existing WebP: ${path.relative(directory, outputPath)}`);
        skipped += 1;
        continue;
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }

    const temporaryPath = `${outputPath}.${randomUUID()}.tmp`;

    try {
      const result = await sharp(inputPath).webp({ quality }).toFile(temporaryPath);
      await rename(temporaryPath, outputPath);
      log(
        `Converted ${path.relative(directory, inputPath)} -> ${path.relative(directory, outputPath)} ` +
          `(${result.width}x${result.height}, ${Math.round(result.size / 1024)} KB)`,
      );
      converted += 1;
    } catch (error) {
      await rm(temporaryPath, { force: true });
      throw new Error(`Failed to convert "${inputPath}" to WebP: ${error.message}`);
    }
  }

  if (files.length === 0) {
    log(`No PNG images found in ${directory}.`);
  } else {
    log(`Image conversion complete: ${converted} converted, ${skipped} skipped.`);
  }

  return { converted, skipped };
}

function parseArguments(args) {
  const options = { quality: 80, overwrite: false };

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--overwrite") {
      options.overwrite = true;
    } else if (args[index] === "--quality") {
      const value = args[index + 1];
      if (!value) throw new Error("--quality requires a value from 1 to 100.");
      options.quality = Number(value);
      index += 1;
    } else {
      throw new Error(`Unknown option "${args[index]}". Use --quality <1-100> or --overwrite.`);
    }
  }

  return options;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    await convertPngsToWebp(projectDirectory, parseArguments(process.argv.slice(2)));
  } catch (error) {
    console.error(`PNG to WebP conversion failed: ${error.message}`);
    process.exitCode = 1;
  }
}
