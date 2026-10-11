# Project conventions

- Use Astro, TypeScript, MDX, semantic HTML, and CSS custom properties. Keep pages statically
  generated; do not add a backend, database, runtime AI service, or client-side framework without
  an approved feature that needs one.
- Keep dependencies minimal and prefer Astro components and CSS over JavaScript.
- Put each case study and its media in `src/content/projects/<project-slug>/`. The lowercase
  kebab-case directory is the URL slug; put its MDX entry at `index.mdx`.
- Keep metadata aligned with the strict collection schema in `src/content.config.ts`. Required
  fields are title, description, year, cover, and cover alt text; optional fields stay optional.
- Import image, video, and caption files locally from the same project directory. Do not construct
  asset URLs from runtime input or use server-side filesystem access at runtime.
- Compose and reorder the typed MDX blocks as the case-study story requires. The MDX validator in
  `src/content/validate-mdx-blocks.mjs` enforces known block properties, required values, local
  media files, and component-specific constraints; update it with any block API change.
- Use native video controls and provide a local WebVTT captions track for video blocks.
- `order` controls both homepage project order and previous/next case-study navigation.
- Run `npm run check` and `npm run build` to validate schemas, slugs, blocks, imports, and static
  media output.
- Run `npm test` for validator tests and `npm run validate` for the complete content/build-output
  quality gate before publishing.
- Use accessible landmarks, heading order, keyboard focus styles, descriptive image alternatives,
  and reduced-motion support. Prefer native HTML behavior and do not add motion for decoration.
- Follow the existing editorial visual system: generous space, considered typography, restrained
  color, and imagery presented without unnecessary framing or rounded-card UI.
- Put global design tokens and shared responsive rules in `src/styles/global.css`. Avoid one-off
  styles when an existing token or component expresses the same intent.
- Add or update documentation when changing project workflows or conventions. Before finishing a
  change, run the relevant checks and production build, and report any unavailable validation
  clearly.
