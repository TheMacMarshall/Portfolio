import { readdir, readFile, stat } from "node:fs/promises";
import { extname, join, relative, resolve, sep } from "node:path";

const htmlAttributes = (html, tagName) => {
  const tags = [...html.matchAll(new RegExp(`<${tagName}\\b[^>]*>`, "gi"))].map(
    ([tag]) => tag,
  );

  return tags.map((tag) =>
    Object.fromEntries(
      [...tag.matchAll(/([^\s=<>/]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+)))?/g)]
        .filter(([, name]) => name.toLowerCase() !== tagName.toLowerCase())
        .map(([, name, , doubleQuoted, singleQuoted, unquoted]) => [
          name.toLowerCase(),
          (doubleQuoted ?? singleQuoted ?? unquoted ?? "").replaceAll("&amp;", "&"),
        ]),
    ),
  );
};

const pageUrlFromFile = (distDir, htmlFile) => {
  const page = relative(distDir, htmlFile).split(sep).join("/");
  if (page === "index.html") return "/";
  if (page.endsWith("/index.html")) return `/${page.slice(0, -"index.html".length)}`;
  return `/${page}`;
};

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? listFiles(path) : [path];
    }),
  );

  return nested.flat();
}

function resolveStaticTarget(distDir, targetPath) {
  if (!targetPath.startsWith("/") || targetPath.startsWith("//")) return undefined;

  const normalizedPath = decodeURIComponent(targetPath);
  const pagePath = normalizedPath.endsWith("/") || !extname(normalizedPath)
    ? join(normalizedPath, "index.html")
    : normalizedPath;
  const candidate = resolve(distDir, `.${pagePath}`);
  if (candidate !== distDir && !candidate.startsWith(`${distDir}${sep}`)) return undefined;

  return candidate;
}

function getBasePath() {
  const [owner, repository] = (process.env.GITHUB_REPOSITORY ?? "").split("/");
  if (!repository || repository.toLowerCase() === `${owner?.toLowerCase()}.github.io`) return "/";
  return `/${repository}/`;
}

function withoutBasePath(pathname, basePath) {
  if (basePath === "/") return pathname;
  if (pathname === basePath.slice(0, -1)) return "/";
  return pathname.startsWith(basePath) ? `/${pathname.slice(basePath.length)}` : pathname;
}

export async function validateBuildOutput(distDir, { basePath = getBasePath() } = {}) {
  const absoluteDist = resolve(distDir);
  const files = await listFiles(absoluteDist);
  const htmlFiles = files.filter((file) => extname(file).toLowerCase() === ".html");
  const errors = [];
  const warnings = [];
  const idsByPage = new Map();

  if (htmlFiles.length === 0) {
    return { errors: [`No HTML pages found in ${absoluteDist}.`], warnings, pages: 0 };
  }

  const pages = await Promise.all(
    htmlFiles.map(async (file) => ({
      file,
      html: await readFile(file, "utf8"),
      url: pageUrlFromFile(absoluteDist, file),
    })),
  );

  for (const { file, html, url } of pages) {
    idsByPage.set(
      url,
      new Set(
        [...html.matchAll(/\bid\s*=\s*("([^"]*)"|'([^']*)')/gi)].map(
          ([, , doubleQuoted, singleQuoted]) => doubleQuoted ?? singleQuoted,
        ),
      ),
    );
  }

  for (const { file, html, url } of pages) {
    const label = relative(absoluteDist, file).split(sep).join("/");
    const titles = [...html.matchAll(/<title(?:\s[^>]*)?>([\s\S]*?)<\/title>/gi)];
    const descriptions = htmlAttributes(html, "meta").filter(
      (attributes) => attributes.name?.toLowerCase() === "description",
    );
    const robotsDirectives = htmlAttributes(html, "meta").filter(
      (attributes) => attributes.name?.toLowerCase() === "robots",
    );

    if (titles.length !== 1 || !titles[0][1].trim()) {
      errors.push(`${label}: expected exactly one non-empty SEO <title>.`);
    }
    if (descriptions.length !== 1 || !descriptions[0].content?.trim()) {
      errors.push(`${label}: expected exactly one non-empty meta description.`);
    }
    if (
      robotsDirectives.length !== 1 ||
      robotsDirectives[0].content?.trim().toLowerCase() !== "noindex, nofollow"
    ) {
      errors.push(`${label}: expected a robots directive of "noindex, nofollow".`);
    }
    if (!html.includes('property="og:title"') || !html.includes('property="og:description"')) {
      errors.push(`${label}: Open Graph title or description metadata is missing.`);
    }

    const headings = [...html.matchAll(/<h([1-6])\b[^>]*>/gi)].map(([, level]) =>
      Number(level),
    );
    if (headings.filter((level) => level === 1).length !== 1) {
      errors.push(`${label}: expected exactly one level-one heading.`);
    }
    for (let index = 1; index < headings.length; index += 1) {
      if (headings[index] > headings[index - 1] + 1) {
        errors.push(
          `${label}: heading hierarchy skips from h${headings[index - 1]} to h${headings[index]}.`,
        );
        break;
      }
    }

    for (const image of htmlAttributes(html, "img")) {
      if (image.alt === undefined) errors.push(`${label}: image is missing an alt attribute.`);
      if (!image.width || !image.height) {
        errors.push(`${label}: image is missing an intrinsic width or height.`);
      }
    }

    for (const video of htmlAttributes(html, "video")) {
      if (!("controls" in video)) {
        errors.push(`${label}: video is missing controls.`);
      }
      if (!video.poster) errors.push(`${label}: video is missing a poster image.`);
      const controlsList = new Set((video.controlslist ?? "").split(/\s+/).filter(Boolean));
      for (const control of ["nodownload", "noplaybackrate", "noremoteplayback"]) {
        if (!controlsList.has(control)) {
          errors.push(`${label}: video controls are missing "${control}".`);
        }
      }
      if (!("disablepictureinpicture" in video)) {
        errors.push(`${label}: video picture-in-picture is not disabled.`);
      }
      if (!("disableremoteplayback" in video)) {
        errors.push(`${label}: video remote playback is not disabled.`);
      }
    }
    for (const link of htmlAttributes(html, "a")) {
      if (!link.href) continue;
      let destination;
      try {
        destination = new URL(link.href, `https://portfolio.invalid${url}`);
      } catch {
        errors.push(`${label}: invalid link URL "${link.href}".`);
        continue;
      }

      if (destination.origin !== "https://portfolio.invalid") continue;

      const targetPath = withoutBasePath(destination.pathname, basePath);
      const targetFile = resolveStaticTarget(absoluteDist, targetPath);
      if (
        targetFile &&
        !(await stat(targetFile).catch(async () => stat(join(targetFile, "index.html")).catch(() => undefined)))
      ) {
        errors.push(`${label}: broken local link "${link.href}".`);
        continue;
      }

      if (destination.hash) {
        const targetUrl = targetPath || "/";
        const targetPage = pages.find((page) => page.url === targetUrl)?.url;
        const targetIds = targetPage ? idsByPage.get(targetPage) : undefined;
        if (targetIds && !targetIds.has(decodeURIComponent(destination.hash.slice(1)))) {
          errors.push(`${label}: link "${link.href}" points to a missing anchor.`);
        }
      }
    }

    for (const tag of [
      ...htmlAttributes(html, "img"),
      ...htmlAttributes(html, "script"),
      ...htmlAttributes(html, "link"),
      ...htmlAttributes(html, "source"),
      ...htmlAttributes(html, "track"),
    ]) {
      const sourceSet = tag.srcset
        ? tag.srcset.split(",").map((source) => source.trim().split(/\s+/)[0])
        : [];
      for (const assetUrl of [tag.src, tag.href, ...sourceSet].filter(Boolean)) {
        const assetPath = withoutBasePath(assetUrl, basePath);
        if (!assetPath.startsWith("/_astro/")) continue;
        const assetFile = resolveStaticTarget(absoluteDist, assetPath);
        if (!assetFile || !(await stat(assetFile).catch(() => undefined))) {
          errors.push(`${label}: missing bundled asset "${assetUrl}".`);
        }
      }
    }
  }

  const cssFiles = files.filter((file) => extname(file).toLowerCase() === ".css");
  const css = (await Promise.all(cssFiles.map((file) => readFile(file, "utf8")))).join("\n");
  if (!/prefers-reduced-motion\s*:\s*reduce/.test(css)) {
    errors.push("Built CSS is missing a reduced-motion preference rule.");
  }
  if (!/:focus-visible/.test(css)) errors.push("Built CSS is missing a visible keyboard focus rule.");
  if (!/@media\s*[^{}]*(?:max-width\s*:\s*38rem|width\s*<=\s*38rem)/.test(css)) {
    errors.push("Built CSS is missing the mobile layout breakpoint.");
  }
  if (
    !/@media\s*[^{}]*(?:min-width\s*:\s*38\.01rem|width\s*>=\s*38\.01rem)[^{}]*(?:max-width\s*:\s*58rem|width\s*<=\s*58rem)/.test(
      css,
    )
  ) {
    errors.push("Built CSS is missing the tablet layout breakpoint.");
  }

  for (const file of files) {
    const extension = extname(file).toLowerCase();
    const bytes = (await stat(file)).size;
    const label = relative(absoluteDist, file).split(sep).join("/");

    if ([".avif", ".gif", ".jpeg", ".jpg", ".png", ".webp"].includes(extension) && bytes > 2_000_000) {
      warnings.push(`${label}: image is ${(bytes / 1_000_000).toFixed(1)} MB; optimize before publishing.`);
    }
    if ([".mp4", ".ogv", ".webm"].includes(extension) && bytes > 25_000_000) {
      warnings.push(`${label}: video is ${(bytes / 1_000_000).toFixed(1)} MB; optimize before publishing.`);
    }
  }

  return { errors, warnings, pages: pages.length };
}
