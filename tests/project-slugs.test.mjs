import assert from "node:assert/strict";
import test from "node:test";
import { validateProjectSlugs } from "../src/content/project-slugs.mjs";

test("accepts unique lowercase kebab-case directory slugs", () => {
  assert.doesNotThrow(() =>
    validateProjectSlugs([
      { id: "interface-study", filePath: "src/content/projects/interface-study/index.mdx" },
      { id: "mobility-system", filePath: "src/content/projects/mobility-system/index.mdx" },
    ]),
  );
});

test("rejects a slug that is not lowercase kebab-case and identifies its entry", () => {
  assert.throws(
    () =>
      validateProjectSlugs([
        { id: "Interface-Study", filePath: "src/content/projects/Interface-Study/index.mdx" },
      ]),
    {
      message:
        /Invalid project slug "Interface-Study" in src\/content\/projects\/Interface-Study\/index\.mdx/,
    },
  );
});

test("rejects duplicate case-insensitive slugs and identifies both entries", () => {
  assert.throws(
    () =>
      validateProjectSlugs([
        { id: "interface-study", filePath: "first/index.mdx" },
        { id: "INTERFACE-STUDY", filePath: "second/index.mdx" },
      ]),
    {
      message: /Duplicate project slug "INTERFACE-STUDY" in first\/index\.mdx and second\/index\.mdx/,
    },
  );
});
