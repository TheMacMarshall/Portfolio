# Project content authoring

Each project is a self-contained content entry: one MDX file plus its media. The content
collection builds every project page automatically, and featured entries appear on the homepage.
There is no manual route registry.

## Add a project

1. Copy `templates/project/` to `src/content/projects/<project-slug>/`.
2. Rename the folder using lowercase kebab-case, for example `src/content/projects/cabin-concept/`.
   The folder name is the URL slug; do not add a `slug` frontmatter property.
3. Edit `index.mdx` and replace every starter title, description, cover, alt text, and sample story.
   Remove `placeholder: true` once the project is real and ready to publish.
4. Add project-only assets under its `media/` directory and import them from `index.mdx`.
   PNG files can be converted in place to sibling WebP files with `npm run convert:images`.
   The command scans all project folders recursively, uses quality 80, preserves each PNG, and
   skips a WebP if that output already exists. Use `npm run convert:images -- --overwrite` only
   when you want to replace existing WebP files, or set a different quality with
   `npm run convert:images -- --quality 85`. Update the image imports and frontmatter in `index.mdx`
   to reference the generated `.webp` files; the converter does not rewrite project content.
5. Set `featured: true` if it should appear on the homepage. Use `order` to control homepage
   ordering and previous/next case-study navigation; missing/equal orders sort after/between
   explicitly ordered projects by slug.
6. Run `npm test` and `npm run validate`, then complete the checklist below.

Example project folder:

```text
src/content/projects/cabin-concept/
├── index.mdx
└── media/
    ├── cover.webp
    ├── interface-detail.webp
    ├── interaction.mp4
    └── interaction.en.vtt
```

## Metadata

Required frontmatter:

```yaml
title: "Cabin concept"
description: "A short, accurate summary of the work."
year: 2026
cover: ./media/cover.webp
coverAlt: "A vehicle interface showing a route overview and cabin controls."
```

Optional properties:

```yaml
role:
  - Product design
  - Design leadership
client: "Client name, only when approved for publication"
industry: Automotive
disciplines:
  - UX
  - Interface design
tags:
  - Concept
featured: true
order: 3
placeholder: false
```

Do not invent clients, results, awards, or research. Only include details you can accurately and
publicly share. Unknown metadata is rejected by the strict schema. The cover must resolve as an
Astro local image import; Astro validates and bundles it during the build.

## MDX components

Import only the blocks a story uses. Relative block imports are from the project entry file;
media imports are relative to that project and must stay within its directory.

```mdx
import RichText from "../../../components/case-study/RichText.astro";
import FullWidthImage from "../../../components/case-study/FullWidthImage.astro";
import SplitImage from "../../../components/case-study/SplitImage.astro";
import ImageGallery from "../../../components/case-study/ImageGallery.astro";
import Slideshow from "../../../components/case-study/Slideshow.astro";
import SlideshowSlide from "../../../components/case-study/SlideshowSlide.astro";
import VideoBlock from "../../../components/case-study/VideoBlock.astro";
import BeforeAfter from "../../../components/case-study/BeforeAfter.astro";
import PullQuote from "../../../components/case-study/PullQuote.astro";
import KeyMetrics from "../../../components/case-study/KeyMetrics.astro";
import Metric from "../../../components/case-study/Metric.astro";
import FullBleedMedia from "../../../components/case-study/FullBleedMedia.astro";

import cover from "./media/cover.webp";
import detail from "./media/interface-detail.webp";
import comparisonBefore from "./media/concept-before.webp";
import comparisonAfter from "./media/concept-after.webp";
import prototype from "./media/interaction.mp4";
import poster from "./media/interaction-poster.webp";
import captions from "./media/interaction.en.vtt?url";
```

Do not import assets from `public/`, use remote URLs, or construct media paths from strings. Imported
assets are statically discovered, checked, optimized where supported, and written into the output
site at build time.

For batch image conversion, run `npm run convert:images` from the project root. The converter
reports each output and any failures; PNG originals remain available until you choose to remove
them after reviewing the generated WebP and updating the MDX references.

### Rich text and headings

Use `RichText` for prose and Markdown headings. Start story sections at `##` below the page's `h1`;
use `###` for subsections.

```mdx
<RichText>

## Context

Explain the setting, audience, constraints, and what is known versus assumed.

### The design question

Describe the challenge without adding confidential information or unsupported claims.

</RichText>
```

Properties: none. Markdown content goes between the component tags.

### Full-width image

```mdx
<FullWidthImage
  src={detail}
  alt="A route overview displayed beside the vehicle's charging status."
  caption="Optional image caption."
/>
```

Required: imported `src`, descriptive `alt`. Optional: `caption`.

### Image and text split

```mdx
<SplitImage
  src={detail}
  alt="A close view of the route summary and charging status."
  imageSide="right"
  caption="Optional image caption."
>

### Supporting detail

Explain how to read the image and why this detail matters to the story.

</SplitImage>
```

Required: imported `src`, descriptive `alt`, and `imageSide` set to `"left"` or `"right"`.
Optional: `caption`. Markdown text goes between the component tags.

### Image gallery

An image gallery needs at least two `FullWidthImage` blocks. Each image needs its own alt text.
It renders as a responsive two-column grid, not an interactive slideshow.

```mdx
<ImageGallery label="Exploration screens">
  <FullWidthImage src={cover} alt="The starting screen and its navigation." />
  <FullWidthImage src={detail} alt="The expanded route details screen." />
</ImageGallery>
```

Optional: accessible gallery `label` (defaults to “Project image gallery”).

### Slideshow

```mdx
<Slideshow title="Interface sequence" subtitle="Optional context for this sequence.">
  <SlideshowSlide src={cover} alt="The route overview and primary action." caption="Overview" />
  <SlideshowSlide src={detail} alt="The expanded route and status details." caption="Detail" />
</Slideshow>
```

Use at least two slides. Each slide requires an imported local image and descriptive `alt` text;
`caption` is optional. The slideshow autoplays horizontally by default and includes previous/next,
slide-selection, and pause/resume controls. It pauses while hovered or focused, and respects reduced
motion preferences. The `title` and `subtitle` are optional; set `autoplay={false}` to disable
automatic advancement while retaining manual controls.

### Video, poster, and captions

```mdx
<VideoBlock
  src={prototype}
  alt="A short prototype showing how the route overview changes during a journey."
  caption="Optional video caption."
/>
```

Required: local imported video `src` and descriptive `alt`. Native controls, `preload="metadata"`,
and inline playback are enabled; download, playback-rate, picture-in-picture, and remote-playback
controls are disabled where the browser supports these media attributes. For an automatic poster, keep a sibling image named
`<video-name>-poster.webp` (or `.avif`, `.png`, `.jpg`, `.jpeg`, or `.gif`). If no such image exists,
the development server and production build extract the video's first frame to an optimized WebP.
This generated file is temporary and ignored by Git; no visitor-side extraction is used. You can
also import a poster and pass it explicitly as `poster={poster}` to use a differently named image.
Captions are optional for clips without meaningful speech or audio; when a clip does contain
meaningful speech or audio, add a local WebVTT track with `captions={captions}` and provide accurate
captions.

### Before/after comparison

```mdx
<BeforeAfter
  before={comparisonBefore}
  after={comparisonAfter}
  beforeAlt="Initial concept with the route and status competing for attention."
  afterAlt="Revised concept with the route visually separated from status."
  beforeLabel="Initial concept"
  afterLabel="Revised concept"
/>
```

Required: local `before` and `after` images with separate descriptive alt text. Optional labels
default to “Before” and “After”. Do not describe a concept as shipped or successful unless that is
accurate and publishable.

### Pull quote and key metrics

```mdx
<PullQuote quote="Use a verified, publishable quote or a clearly identified design principle.">
  <KeyMetrics>
    <Metric value="3" label="verified measures, with context and source" />
    <Metric value="12 weeks" label="accurate project duration" />
  </KeyMetrics>
</PullQuote>
```

`PullQuote` requires `quote` and optionally accepts `attribution`. `KeyMetrics` and each nested
`Metric` are optional. Every `Metric` requires text `value` and `label`. Use only verified, approved
figures; omit the metrics block when a project has no metrics to share.

### Full-bleed media

```mdx
<FullBleedMedia
  src={cover}
  alt="A wide view of the complete dashboard concept."
  caption="Optional closing caption."
/>
```

Required: local image `src` and descriptive `alt`. Optional: `caption`.

## Media preparation

- Prefer AVIF or WebP for photographs and raster interface imagery, and SVG for genuinely
  vector-based artwork. Export at the largest display size required, not at an arbitrarily huge
  source resolution.
- As a practical starting point, aim for cover/hero images under 500 KB and other still images
  under 300 KB. Preserve detail where the work needs it; `npm run validate` warns about generated
  raster images over 2 MB.
- Use a local image editor or export tool to resize and convert files before adding them to Git.
  Compare the optimized result at full size; avoid destructive compression of fine interface
  details and text.
- Prefer MP4 (H.264) or WebM for short interface demonstrations. Provide a poster image and a
  caption track; avoid animated GIFs for long or photographic sequences. The validation script
  warns about built video files over 25 MB.
- If FFmpeg is already installed locally, a starting point for an MP4 encode is:

  ```sh
  ffmpeg -i source.mov -vf "scale='min(1920,iw)':-2" -c:v libx264 -crf 24 \
    -preset slow -pix_fmt yuv420p -movflags +faststart -an interaction.mp4
  ```

- Keep originals separately if they are archival source files; only commit the optimized
  publication assets needed by the project.

## Case-study publishing checklist

- [ ] Folder uses a unique lowercase kebab-case slug.
- [ ] Required metadata is accurate, complete, and public; optional client/industry details have
      permission to be shared.
- [ ] `featured` and `order` are set intentionally; previous/next navigation is sensible.
- [ ] Sample/placeholder content is replaced and `placeholder: true` is removed.
- [ ] Every image has accurate, useful alt text; decorative information is not conveyed only by
      color or imagery.
- [ ] Video has a poster, native controls, and checked captions synchronized to the audio.
- [ ] Headings follow the page title with `h2`, then nested `h3`; no heading levels are skipped.
- [ ] Local links and in-page anchors lead to the intended destination.
- [ ] Images/video are optimized; no accidental multi-megabyte images or oversized clips remain.
- [ ] `npm test` and `npm run validate` pass.
- [ ] Review at desktop, tablet, and mobile widths, then keyboard-tab through navigation and links.
- [ ] Review SEO title and description, proofread all content, and remove confidential details.
