export function validateProjectSlugs(projects) {
  const slugs = new Map();

  for (const project of projects) {
    const normalizedSlug = project.id.toLowerCase();
    const previousFile = slugs.get(normalizedSlug);

    if (previousFile) {
      throw new Error(
        `Duplicate project slug "${project.id}" in ${previousFile} and ${project.filePath ?? "unknown file"}.`,
      );
    }

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(project.id)) {
      throw new Error(
        `Invalid project slug "${project.id}" in ${project.filePath ?? "unknown file"}. ` +
          "Use a lowercase kebab-case project directory name.",
      );
    }

    slugs.set(normalizedSlug, project.filePath ?? project.id);
  }
}
