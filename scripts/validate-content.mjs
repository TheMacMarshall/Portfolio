import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validateBuildOutput } from "../src/content/validate-build-output.mjs";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const astroCli = fileURLToPath(new URL("../node_modules/astro/bin/astro.mjs", import.meta.url));

for (const command of ["check", "build"]) {
  console.log(`\n> astro ${command}`);
  const result = spawnSync(process.execPath, [astroCli, command], {
    cwd: projectRoot,
    stdio: "inherit",
  });

  if (result.error) {
    console.error(`Could not run Astro ${command}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`Astro ${command} failed. See the diagnostic above for the affected source file.`);
    process.exit(result.status ?? 1);
  }
}

const result = await validateBuildOutput(fileURLToPath(new URL("../dist/", import.meta.url)));
if (result.errors.length > 0) {
  console.error("\nGenerated-site validation failed:");
  for (const error of result.errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`\nGenerated-site validation passed for ${result.pages} HTML pages.`);
for (const warning of result.warnings) console.warn(`Warning: ${warning}`);
