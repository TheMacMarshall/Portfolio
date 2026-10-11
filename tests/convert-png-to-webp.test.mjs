import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import { convertPngsToWebp } from "../scripts/convert-png-to-webp.mjs";

test("converts nested PNG files into adjacent WebP files and preserves originals", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "portfolio-images-"));

  try {
    const mediaDirectory = path.join(directory, "project", "media");
    await mkdir(mediaDirectory, { recursive: true });
    const pngPath = path.join(mediaDirectory, "cover.png");
    const webpPath = path.join(mediaDirectory, "cover.webp");

    await sharp({
      create: {
        width: 2,
        height: 2,
        channels: 4,
        background: { r: 30, g: 80, b: 120, alpha: 1 },
      },
    })
      .png()
      .toFile(pngPath);

    const result = await convertPngsToWebp(directory, { log: () => {} });

    assert.deepEqual(result, { converted: 1, skipped: 0 });
    assert.equal((await readFile(pngPath)).subarray(1, 4).toString(), "PNG");
    assert.equal((await sharp(webpPath).metadata()).format, "webp");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("skips existing WebP files unless overwrite is explicitly enabled", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "portfolio-images-"));

  try {
    const pngPath = path.join(directory, "cover.png");
    const webpPath = path.join(directory, "cover.webp");

    await sharp({
      create: {
        width: 1,
        height: 1,
        channels: 3,
        background: { r: 100, g: 120, b: 140 },
      },
    })
      .png()
      .toFile(pngPath);
    await sharp({
      create: {
        width: 1,
        height: 1,
        channels: 3,
        background: { r: 1, g: 2, b: 3 },
      },
    })
      .webp()
      .toFile(webpPath);

    const existingWebp = await readFile(webpPath);
    const skippedResult = await convertPngsToWebp(directory, { log: () => {} });
    assert.deepEqual(skippedResult, { converted: 0, skipped: 1 });
    assert.deepEqual(await readFile(webpPath), existingWebp);

    const overwrittenResult = await convertPngsToWebp(directory, {
      overwrite: true,
      log: () => {},
    });
    assert.deepEqual(overwrittenResult, { converted: 1, skipped: 0 });
    assert.notDeepEqual(await readFile(webpPath), existingWebp);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects invalid quality values", async () => {
  await assert.rejects(
    convertPngsToWebp(os.tmpdir(), { quality: 101, log: () => {} }),
    { message: /quality must be an integer from 1 to 100/ },
  );
});
