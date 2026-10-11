import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { unified } from "unified";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { validateMdxBlocks } from "../src/content/validate-mdx-blocks.mjs";

test("automatically imports the extracted poster when VideoBlock omits poster", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "portfolio-mdx-video-"));
  const mediaDirectory = join(directory, "media");
  await mkdir(mediaDirectory);
  await writeFile(join(mediaDirectory, "clip.mp4"), "video");
  await writeFile(join(mediaDirectory, "clip-poster.generated.webp"), "poster");
  t.after(() => rm(directory, { recursive: true, force: true }));

  const source = `import clip from "./media/clip.mp4";\n\n<VideoBlock src={clip} alt="A sample clip." />`;
  const processor = unified().use(remarkParse).use(remarkMdx).use(validateMdxBlocks);
  const tree = processor.parse(source);
  const file = {
    path: join(directory, "index.mdx"),
    fail(message) {
      throw new Error(String(message));
    },
  };

  await processor.run(tree, file);

  const videoBlock = tree.children.find(
    (node) => node.type === "mdxJsxFlowElement" && node.name === "VideoBlock",
  );
  const poster = videoBlock.attributes.find((attribute) => attribute.name === "poster");
  assert.match(poster.value.value, /^__portfolioVideoPoster\d+$/);
  assert.ok(
    tree.children.some(
      (node) =>
        node.type === "mdxjsEsm" &&
        node.value.includes('./media/clip-poster.generated.webp'),
    ),
  );
});

test("accepts a titled slideshow with two locally imported image slides", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "portfolio-mdx-slideshow-"));
  const mediaDirectory = join(directory, "media");
  await mkdir(mediaDirectory);
  await writeFile(join(mediaDirectory, "first.svg"), "<svg />");
  await writeFile(join(mediaDirectory, "second.svg"), "<svg />");
  t.after(() => rm(directory, { recursive: true, force: true }));

  const source = `import first from "./media/first.svg";
import second from "./media/second.svg";

<Slideshow title="Interface sequence" subtitle="Two screens">
  <SlideshowSlide src={first} alt="First interface screen." />
  <SlideshowSlide src={second} alt="Second interface screen." />
</Slideshow>`;
  const processor = unified().use(remarkParse).use(remarkMdx).use(validateMdxBlocks);
  const tree = processor.parse(source);
  const file = {
    path: join(directory, "index.mdx"),
    fail(message) {
      throw new Error(String(message));
    },
  };

  await processor.run(tree, file);
});

test("rejects a slideshow with fewer than two slides", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "portfolio-mdx-slideshow-"));
  const mediaDirectory = join(directory, "media");
  await mkdir(mediaDirectory);
  await writeFile(join(mediaDirectory, "first.svg"), "<svg />");
  t.after(() => rm(directory, { recursive: true, force: true }));

  const source = `import first from "./media/first.svg";

<Slideshow>
  <SlideshowSlide src={first} alt="First interface screen." />
</Slideshow>`;
  const processor = unified().use(remarkParse).use(remarkMdx).use(validateMdxBlocks);
  const file = {
    path: join(directory, "index.mdx"),
    fail(message) {
      throw new Error(String(message));
    },
  };

  await assert.rejects(processor.run(processor.parse(source), file), /at least two <SlideshowSlide>/);
});
