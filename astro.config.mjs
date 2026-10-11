import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import { unified } from "@astrojs/markdown-remark";
import { validateMdxBlocks } from "./src/content/validate-mdx-blocks.mjs";

const markdownProcessor = unified({ remarkPlugins: [validateMdxBlocks] });
const [githubOwner, githubRepository] = (process.env.GITHUB_REPOSITORY ?? "").split("/");
const isGitHubUserSite =
  githubOwner && githubRepository?.toLowerCase() === `${githubOwner.toLowerCase()}.github.io`;
const site =
  process.env.SITE_URL ??
  (githubOwner && githubRepository ? `https://${githubOwner}.github.io` : "http://localhost:4321");
const base =
  githubRepository && !isGitHubUserSite
    ? `/${githubRepository}/`
    : "/";

export default defineConfig({
  site,
  base,
  output: "static",
  trailingSlash: "always",
  server: {
    host: true,
    port: 4321,
  },
  integrations: [mdx({ processor: markdownProcessor })],
});
