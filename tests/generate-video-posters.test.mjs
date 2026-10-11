import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { generateVideoPosters } from "../scripts/generate-video-posters.mjs";

async function createProject(t) {
  const directory = await mkdtemp(join(tmpdir(), "portfolio-video-posters-"));
  const mediaDirectory = join(directory, "example", "media");
  await mkdir(mediaDirectory, { recursive: true });
  t.after(() => rm(directory, { recursive: true, force: true }));

  const videoPath = join(mediaDirectory, "prototype.mp4");
  await writeFile(videoPath, "video fixture");
  return { directory, mediaDirectory, videoPath };
}

test("generates a first-frame poster once when no supplied poster exists", async (t) => {
  const { directory, mediaDirectory, videoPath } = await createProject(t);
  const outputPath = join(mediaDirectory, "prototype-poster.generated.webp");
  let extractionCount = 0;

  const options = {
    log: () => {},
    extractFrame: async (_videoPath, posterPath) => {
      extractionCount += 1;
      await writeFile(posterPath, "generated poster");
    },
  };

  assert.deepEqual(await generateVideoPosters(directory, options), { generated: 1, skipped: 0 });
  assert.equal(await readFile(outputPath, "utf8"), "generated poster");
  assert.deepEqual(await generateVideoPosters(directory, options), { generated: 0, skipped: 1 });
  assert.equal(extractionCount, 1);
  assert.equal(await readFile(videoPath, "utf8"), "video fixture");
});

test("does not overwrite a convention-named supplied poster", async (t) => {
  const { directory, mediaDirectory } = await createProject(t);
  const posterPath = join(mediaDirectory, "prototype-poster.webp");
  await writeFile(posterPath, "supplied poster");

  const result = await generateVideoPosters(directory, {
    log: () => {},
    extractFrame: () => {
      assert.fail("a supplied poster should be used instead of extracting a frame");
    },
  });

  assert.deepEqual(result, { generated: 0, skipped: 1 });
  assert.equal(await readFile(posterPath, "utf8"), "supplied poster");
});

test("reports extraction failures with the video path", async (t) => {
  const { directory, videoPath } = await createProject(t);
  await assert.rejects(
    generateVideoPosters(directory, {
      log: () => {},
      extractFrame: () => {
        throw new Error("decoder failed");
      },
    }),
    (error) =>
      error.message.includes(`Could not generate a poster for "${videoPath}": decoder failed`),
  );
});
