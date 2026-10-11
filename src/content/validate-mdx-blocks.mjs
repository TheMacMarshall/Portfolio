import { existsSync } from "node:fs";
import { dirname, extname, relative, resolve, sep } from "node:path";

const blockRules = {
  RichText: { allowed: [], required: [] },
  FullWidthImage: {
    allowed: ["src", "alt", "caption"],
    required: ["src", "alt"],
    text: ["alt"],
    media: { src: "image" },
  },
  SplitImage: {
    allowed: ["src", "alt", "imageSide", "caption"],
    required: ["src", "alt", "imageSide"],
    text: ["alt"],
    media: { src: "image" },
  },
  ImageGallery: { allowed: ["label"], required: [], text: ["label"] },
  Slideshow: {
    allowed: ["title", "subtitle", "autoplay"],
    required: [],
    optional: ["title", "subtitle", "autoplay"],
    text: ["title", "subtitle"],
  },
  SlideshowSlide: {
    allowed: ["src", "alt", "caption"],
    required: ["src", "alt"],
    text: ["alt"],
    media: { src: "image" },
  },
  VideoBlock: {
    allowed: ["src", "poster", "alt", "captions", "caption"],
    required: ["src", "alt"],
    optional: ["poster"],
    text: ["alt"],
    media: { src: "video", poster: "image" },
  },
  BeforeAfter: {
    allowed: ["before", "after", "beforeAlt", "afterAlt", "beforeLabel", "afterLabel"],
    required: ["before", "after", "beforeAlt", "afterAlt"],
    text: ["beforeAlt", "afterAlt"],
    media: { before: "image", after: "image" },
  },
  PullQuote: {
    allowed: ["quote", "attribution"],
    required: ["quote"],
    text: ["quote"],
  },
  KeyMetrics: { allowed: [], required: [] },
  Metric: {
    allowed: ["value", "label"],
    required: ["value", "label"],
    text: ["value", "label"],
  },
  FullBleedMedia: {
    allowed: ["src", "alt", "caption"],
    required: ["src", "alt"],
    media: { src: "image" },
  },
};

const mediaImportPattern = /\bimport\s+([A-Za-z_$][\w$]*)\s+from\s*["'](\.[^"']+)["']/g;
const mediaExtensions = {
  image: new Set([".avif", ".gif", ".jpeg", ".jpg", ".png", ".svg", ".webp"]),
  video: new Set([".mp4", ".ogv", ".webm"]),
  captions: new Set([".vtt"]),
};
const posterExtensions = [".webp", ".avif", ".png", ".jpg", ".jpeg", ".gif"];

function visit(node, callback) {
  if (!node || typeof node !== "object") return;
  callback(node);

  if (Array.isArray(node.children)) {
    for (const child of node.children) visit(child, callback);
  }
}

function fail(file, message) {
  file.fail(`Case-study MDX validation: ${message}`, null, "portfolio:mdx-validation");
}

export function validateMdxBlocks() {
  return (tree, file) => {
    const importedAssets = new Map();
    const importedAssetPaths = new Map();
    const imports = [];

    visit(tree, (node) => {
      if (node.type === "mdxjsEsm" && typeof node.value === "string") {
        for (const match of node.value.matchAll(mediaImportPattern)) {
          const [, localName, importPath] = match;
          const diskPath = resolve(dirname(file.path), importPath.split(/[?#]/, 1)[0]);

          if (!existsSync(diskPath)) {
            fail(file, `media import "${importPath}" does not exist (imported as "${localName}").`);
          }

          importedAssets.set(localName, diskPath);
          importedAssetPaths.set(localName, importPath);
        }
      }

      if (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") {
        imports.push(node);
      }
    });

    for (const node of imports) {
      const rule = blockRules[node.name];
      if (!rule) {
        if (/^[A-Z]/.test(node.name)) {
          fail(file, `unknown content block <${node.name}>.`);
        }
        continue;
      }

      const attributes = new Map();
      for (const attribute of node.attributes ?? []) {
        if (attribute.type !== "mdxJsxAttribute") {
          fail(file, `<${node.name}> does not support spread attributes.`);
        }

        if (!rule.allowed.includes(attribute.name)) {
          fail(file, `<${node.name}> has unsupported property "${attribute.name}".`);
        }

        attributes.set(attribute.name, attribute);
      }

      if (node.name === "VideoBlock" && !attributes.has("poster")) {
        const sourceExpression = attributes.get("src")?.value;
        const videoName =
          sourceExpression?.type === "mdxJsxAttributeValueExpression"
            ? sourceExpression.value.trim()
            : "";
        const videoPath = importedAssets.get(videoName);
        const videoImportPath = importedAssetPaths.get(videoName);

        if (!videoPath || !videoImportPath) {
          fail(file, "<VideoBlock> without poster requires src to reference an imported local video.");
        }

        const cleanImportPath = videoImportPath.split(/[?#]/, 1)[0];
        const videoExtension = extname(cleanImportPath);
        const posterBase = `${cleanImportPath.slice(0, -videoExtension.length)}-poster`;
        let posterImportPath;
        let posterPath;

        for (const extension of posterExtensions) {
          const candidate = `${posterBase}${extension}`;
          const candidatePath = resolve(dirname(file.path), candidate);
          if (existsSync(candidatePath)) {
            posterImportPath = candidate;
            posterPath = candidatePath;
            break;
          }
        }

        if (!posterImportPath) {
          posterImportPath = `${posterBase}.generated.webp`;
          posterPath = resolve(dirname(file.path), posterImportPath);
        }

        if (!existsSync(posterPath)) {
          fail(
            file,
            `no poster found for "${cleanImportPath}". Run "npm run generate:video-posters" to extract its first frame, or add a sibling "${posterBase}.webp" poster.`,
          );
        }

        let posterName = `__portfolioVideoPoster${importedAssets.size}`;
        while (importedAssets.has(posterName)) {
          posterName += "_";
        }

        const importDeclaration = {
          type: "mdxjsEsm",
          value: `import ${posterName} from ${JSON.stringify(posterImportPath)};`,
          data: {
            estree: {
              type: "Program",
              sourceType: "module",
              body: [
                {
                  type: "ImportDeclaration",
                  specifiers: [
                    {
                      type: "ImportDefaultSpecifier",
                      local: { type: "Identifier", name: posterName },
                    },
                  ],
                  source: {
                    type: "Literal",
                    value: posterImportPath,
                    raw: JSON.stringify(posterImportPath),
                  },
                  attributes: [],
                },
              ],
            },
          },
        };
        const posterAttribute = {
          type: "mdxJsxAttribute",
          name: "poster",
          value: {
            type: "mdxJsxAttributeValueExpression",
            value: posterName,
            data: {
              estree: {
                type: "Program",
                sourceType: "module",
                comments: [],
                body: [
                  {
                    type: "ExpressionStatement",
                    expression: { type: "Identifier", name: posterName },
                  },
                ],
              },
            },
          },
        };

        node.attributes.push(posterAttribute);
        attributes.set("poster", posterAttribute);
        importedAssets.set(posterName, posterPath);
        importedAssetPaths.set(posterName, posterImportPath);
        const importIndex = tree.children.findLastIndex((child) => child.type === "mdxjsEsm");
        const yamlIndex = tree.children.findIndex((child) => child.type === "yaml");
        tree.children.splice(importIndex >= 0 ? importIndex + 1 : yamlIndex + 1, 0, importDeclaration);
      }

      for (const name of rule.required) {
        if (!attributes.has(name)) {
          fail(file, `<${node.name}> is missing required property "${name}".`);
        }
      }

      for (const name of rule.text ?? []) {
        if (rule.optional?.includes(name) && !attributes.has(name)) continue;
        const value = attributes.get(name)?.value;
        const text = typeof value === "string" ? value : value?.value;
        if (typeof text !== "string" || text.trim().length === 0) {
          fail(file, `<${node.name}> property "${name}" must be non-empty text.`);
        }
      }

      for (const [name, mediaType] of Object.entries(rule.media ?? {})) {
        if (rule.optional?.includes(name) && !attributes.has(name)) continue;
        const expression = attributes.get(name)?.value;
        const localName =
          expression?.type === "mdxJsxAttributeValueExpression"
            ? expression.value.trim()
            : "";
        const diskPath = importedAssets.get(localName);

        if (!/^[A-Za-z_$][\w$]*$/.test(localName) || !diskPath) {
          fail(
            file,
            `<${node.name} ${name}=...> must reference a local asset imported from this project directory.`,
          );
        }

        const projectRelativePath = relative(dirname(file.path), diskPath);
        if (
          projectRelativePath === ".." ||
          projectRelativePath.startsWith(`..${sep}`) ||
          !mediaExtensions[mediaType].has(extname(diskPath).toLowerCase())
        ) {
          fail(
            file,
            `<${node.name} ${name}=...> must reference a ${mediaType} file inside this project's directory.`,
          );
        }
      }

      if (node.name === "VideoBlock" && attributes.has("captions")) {
        const expression = attributes.get("captions").value;
        const localName =
          expression?.type === "mdxJsxAttributeValueExpression"
            ? expression.value.trim()
            : "";
        const diskPath = importedAssets.get(localName);

        if (!/^[A-Za-z_$][\w$]*$/.test(localName) || !diskPath) {
          fail(file, "<VideoBlock captions=...> must reference a local WebVTT file imported from this project directory.");
        }

        const projectRelativePath = relative(dirname(file.path), diskPath);
        if (
          projectRelativePath === ".." ||
          projectRelativePath.startsWith(`..${sep}`) ||
          !mediaExtensions.captions.has(extname(diskPath).toLowerCase())
        ) {
          fail(file, "<VideoBlock captions=...> must reference a captions file inside this project's directory.");
        }
      }

      if (node.name === "SplitImage") {
        const imageSide = attributes.get("imageSide")?.value;
        const side = typeof imageSide === "string" ? imageSide : imageSide?.value;
        if (!["left", "right"].includes(side)) {
          fail(file, '<SplitImage imageSide="..."> must be either "left" or "right".');
        }
      }

      if (node.name === "ImageGallery") {
        const imageCount = (node.children ?? []).filter(
          (child) => child.type === "mdxJsxFlowElement" && child.name === "FullWidthImage",
        ).length;
        if (imageCount < 2) {
          fail(file, "<ImageGallery> must contain at least two <FullWidthImage> blocks.");
        }
      }

      if (node.name === "Slideshow") {
        const slideCount = (node.children ?? []).filter(
          (child) => child.type === "mdxJsxFlowElement" && child.name === "SlideshowSlide",
        ).length;
        if (slideCount < 2) {
          fail(file, "<Slideshow> must contain at least two <SlideshowSlide> blocks.");
        }
      }

    }
  };
}
