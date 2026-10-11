import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { validateBuildOutput } from "../src/content/validate-build-output.mjs";

function addRobotsDirective(html) {
  return html.replace(
    "<head>",
    '<head><meta name="robots" content="noindex, nofollow">',
  );
}

async function createFixture(t, { caseStudy = true, video = false } = {}) {
  const directory = await mkdtemp(join(tmpdir(), "portfolio-build-check-"));
  t.after(() => rm(directory, { recursive: true, force: true }));

  await mkdir(join(directory, "_astro"), { recursive: true });
  await writeFile(join(directory, "_astro", "poster.webp"), "poster");
  if (video) {
    await writeFile(join(directory, "_astro", "clip.mp4"), "video");
  }
  await writeFile(
    join(directory, "index.html"),
    `<!doctype html><html lang="en"><head><title>Home</title><meta name="description" content="Home description"><meta property="og:title" content="Home"><meta property="og:description" content="Home description"></head><body><h1>Home</h1><h2 id="work">Work</h2><a href="/case/#story">Case study</a></body></html>`,
  );

  if (caseStudy) {
    const caseDirectory = join(directory, "case");
    await mkdir(caseDirectory);
    const videoMarkup = video
      ? '<video controls controlslist="nodownload noplaybackrate noremoteplayback" disablepictureinpicture disableremoteplayback poster="/_astro/poster.webp"><source src="/_astro/clip.mp4"></video>'
      : "";
    await writeFile(
      join(caseDirectory, "index.html"),
      `<!doctype html><html lang="en"><head><title>Case</title><meta name="description" content="Case description"><meta property="og:title" content="Case"><meta property="og:description" content="Case description"></head><body><h1>Case</h1><h2 id="story">Story</h2><img src="/_astro/poster.webp" alt="A descriptive image" width="800" height="500">${videoMarkup}<a href="/">Home</a></body></html>`,
    );
  }

  await writeFile(
    join(directory, "site.css"),
    ":focus-visible { outline: 2px solid; } @media (max-width: 38rem) { body { color: black; } } @media (min-width: 38.01rem) and (max-width: 58rem) { body { color: black; } } @media (prefers-reduced-motion: reduce) { * { transition: none; } }",
  );

  for (const pagePath of [
    join(directory, "index.html"),
    ...(caseStudy ? [join(directory, "case", "index.html")] : []),
  ]) {
    await writeFile(pagePath, addRobotsDirective(await readFile(pagePath, "utf8")));
  }

  return directory;
}

test("accepts generated pages with valid local routes, media, metadata, and accessible video", async (t) => {
  const directory = await createFixture(t, { video: true });
  const result = await validateBuildOutput(directory);

  assert.deepEqual(result.errors, []);
  assert.equal(result.pages, 2);
});

test("requires every generated page to discourage indexing and link following", async (t) => {
  const directory = await createFixture(t, { caseStudy: false });
  const pagePath = join(directory, "index.html");
  const html = await readFile(pagePath, "utf8");
  await writeFile(pagePath, html.replace('<meta name="robots" content="noindex, nofollow">', ""));

  const result = await validateBuildOutput(directory);
  assert.ok(result.errors.some((error) => error.includes('robots directive of "noindex, nofollow"')));
});

test("reports broken local links and missing anchors by generated page", async (t) => {
  const directory = await createFixture(t, { caseStudy: false });
  await writeFile(
    join(directory, "index.html"),
    `<!doctype html><html lang="en"><head><title>Home</title><meta name="description" content="Home description"><meta property="og:title" content="Home"><meta property="og:description" content="Home description"></head><body><h1>Home</h1><a href="/missing/">Missing page</a><a href="#missing">Missing anchor</a></body></html>`,
  );

  const result = await validateBuildOutput(directory);
  assert.ok(result.errors.some((error) => error.includes('index.html: broken local link "/missing/"')));
  assert.ok(result.errors.some((error) => error.includes('index.html: link "#missing" points to a missing anchor')));
});

test("reports missing image alt text and unstable image dimensions", async (t) => {
  const directory = await createFixture(t, { caseStudy: false });
  await writeFile(
    join(directory, "index.html"),
    `<!doctype html><html lang="en"><head><title>Home</title><meta name="description" content="Home description"><meta property="og:title" content="Home"><meta property="og:description" content="Home description"></head><body><h1>Home</h1><img src="/_astro/poster.webp"></body></html>`,
  );

  const result = await validateBuildOutput(directory);
  assert.ok(result.errors.some((error) => error.includes("image is missing an alt attribute")));
  assert.ok(result.errors.some((error) => error.includes("image is missing an intrinsic width or height")));
});

test("reports missing video controls and poster", async (t) => {
  const directory = await createFixture(t, { caseStudy: false });
  await writeFile(
    join(directory, "index.html"),
    `<!doctype html><html lang="en"><head><title>Home</title><meta name="description" content="Home description"><meta property="og:title" content="Home"><meta property="og:description" content="Home description"></head><body><h1>Home</h1><video><source src="/_astro/clip.mp4"></video></body></html>`,
  );

  const result = await validateBuildOutput(directory);
  assert.ok(result.errors.some((error) => error.includes("video is missing controls")));
  assert.ok(result.errors.some((error) => error.includes("video is missing a poster image")));
});

test("reports enabled video menu actions, picture-in-picture, and remote playback", async (t) => {
  const directory = await createFixture(t, { caseStudy: false });
  await writeFile(
    join(directory, "index.html"),
    `<!doctype html><html lang="en"><head><title>Home</title><meta name="description" content="Home description"><meta property="og:title" content="Home"><meta property="og:description" content="Home description"></head><body><h1>Home</h1><video controls poster="/_astro/poster.webp"><source src="/_astro/clip.mp4"></video></body></html>`,
  );

  const result = await validateBuildOutput(directory);
  assert.ok(result.errors.some((error) => error.includes('video controls are missing "nodownload"')));
  assert.ok(result.errors.some((error) => error.includes('video controls are missing "noplaybackrate"')));
  assert.ok(result.errors.some((error) => error.includes('video controls are missing "noremoteplayback"')));
  assert.ok(result.errors.some((error) => error.includes("video picture-in-picture is not disabled")));
  assert.ok(result.errors.some((error) => error.includes("video remote playback is not disabled")));
});

test("resolves internal routes and bundled media under a GitHub Pages base path", async (t) => {
  const directory = await createFixture(t, { video: true });
  await writeFile(join(directory, "_astro", "app.js"), "console.log('site');");
  await writeFile(
    join(directory, "index.html"),
    addRobotsDirective(`<!doctype html><html lang="en"><head><title>Home</title><meta name="description" content="Home description"><meta property="og:title" content="Home"><meta property="og:description" content="Home description"><script src="/portfolio/_astro/app.js"></script></head><body><h1>Home</h1><h2 id="work">Work</h2><a href="/portfolio/case/#story">Case study</a></body></html>`),
  );
  await writeFile(
    join(directory, "case", "index.html"),
    addRobotsDirective(`<!doctype html><html lang="en"><head><title>Case</title><meta name="description" content="Case description"><meta property="og:title" content="Case"><meta property="og:description" content="Case description"></head><body><h1>Case</h1><h2 id="story">Story</h2><img src="/portfolio/_astro/poster.webp" alt="A descriptive image" width="800" height="500"><video controls controlslist="nodownload noplaybackrate noremoteplayback" disablepictureinpicture disableremoteplayback poster="/portfolio/_astro/poster.webp"><source src="/portfolio/_astro/clip.mp4"></video><a href="/portfolio/">Home</a></body></html>`),
  );

  const result = await validateBuildOutput(directory, { basePath: "/portfolio/" });
  assert.deepEqual(result.errors, []);
});
