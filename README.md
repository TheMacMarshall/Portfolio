# Designer portfolio

A static portfolio built with Astro, TypeScript, and MDX. Each project owns its MDX entry and
media in `src/content/projects/<project-slug>/`.

## Requirements

- Node.js 22.12.0 or newer
- npm

## Install and run locally

From the project root:

```sh
npm install
npm run dev
```

Open `http://localhost:4321/` to preview the homepage. Sample project entries and their artwork
are explicitly marked as placeholders in the content and interface; replace them before publishing.
The `/about/` and `/contact/` pages provide static profile and contact routes. Add the contact
address you want to publish before launch.

## Checks and production build

```sh
npm run check
npm test
npm run build
npm run preview
```

`npm run check` validates Astro, TypeScript, and content collection entries. The static production
site is generated in `dist/`.

## Project content and media

Start from the duplicable template in `templates/project/`. Copy it into
`src/content/projects/<project-slug>/`, where the slug is lowercase kebab-case:

```text
src/content/projects/
└── cabin-concept/                  # Copy of templates/project/
    ├── index.mdx
    └── media/
        ├── cover.webp
        ├── interface.webp
        ├── interaction.mp4
        └── interaction.en.vtt
```

See the full [project authoring guide](./docs/content-authoring.md) for metadata, all content
blocks, media optimization guidance, and the publishing checklist.

To convert project PNG files to WebP, run `npm run convert:images`. It writes `.webp` files beside
the PNGs, preserves originals, and skips existing WebP output unless `--overwrite` is supplied.

## Project validation

Run `npm test` for validator unit tests and `npm run validate` before publishing. The validation
command runs Astro diagnostics and a production build, then checks generated SEO metadata, page
heading order, local links and anchors, local bundled assets, image alt text and intrinsic
dimensions, video controls/posters/captions, keyboard focus and reduced-motion CSS, and media size
budgets. Build errors name the source MDX file for invalid metadata or block/media references.

## Publish on GitHub Pages

This project builds a fully static site to `dist/`; it does not need a backend, runtime API, or paid
service. The package lockfile (`package-lock.json`) is kept with the source so GitHub Actions can
install the same dependency versions used locally.

The workflow in `.github/workflows/deploy.yml` builds and deploys on pushes to `main`, and can also
be started manually from the repository's **Actions** tab. Astro derives the GitHub Pages URL and
base path from `GITHUB_REPOSITORY`, so repository project pages use `/<repository>/` and a
`<owner>.github.io` user site uses `/`. Internal navigation and bundled local media use Astro's
base-aware URLs.

### One-time GitHub setup

1. Add this project to a GitHub repository and include `package-lock.json` in the commit.
2. In the repository, open **Settings → Pages → Build and deployment** and set **Source** to
   **GitHub Actions**.
3. Use the `main` branch, or change the branch filter in `.github/workflows/deploy.yml` to match
   the branch you publish from.
4. Push to that branch. Follow the workflow in **Actions**; when deployment succeeds, its
   `github-pages` environment lists the published URL.

No repository secrets or deploy keys are required. To publish later changes, add or edit the
project content and local media, run `npm test` and `npm run validate`, then commit and push to the
configured branch. GitHub Actions will build and publish the update.

### Add a project and publish it

1. Copy `templates/project/` to `src/content/projects/<lowercase-kebab-case-slug>/`.
2. Update `index.mdx` metadata and story, add project images/videos under its `media/` directory,
   and use the documented MDX blocks. Keep media locally imported.
3. Run `npm test` and `npm run validate`; resolve any content, asset, or build errors.
4. Commit the project, including its media and the lockfile when setting up the repository, then
   push to the configured publishing branch.
