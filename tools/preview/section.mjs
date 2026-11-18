// Standalone, self-contained HTML for one section of a built preview page.
// Usage: node tools/preview/section.mjs <page> <section-id> <out.html> [--offset=0]
//   Run tools/preview/build.mjs <page> first. CSS is compiled for this section only
//   (no site components), fonts are inlined, the page's scripts are bundled inline.
//   --offset: height of a fixed header the section pins under (the site uses 74).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const TOOLS = (process.argv.find((a) => a.startsWith("--tools=")) ?? "--tools=/opt/npm-tools/node_modules").slice(8);
const offset = Number((process.argv.find((a) => a.startsWith("--offset=")) ?? "--offset=0").slice(9));
const [page, id, out] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const require = createRequire(path.join(TOOLS, "x.js"));
const esbuild = require("esbuild");
const tailwind = await import(pathToFileURL(path.join(TOOLS, "tailwindcss/dist/lib.mjs")).href);

const built = fs.readFileSync(path.join(ROOT, "dist-preview", `${page}.html`), "utf8");
const start = built.indexOf(`<section id="${id}"`);
if (start < 0) throw new Error(`no <section id="${id}"> in ${page}.html`);
const section = built.slice(start, built.indexOf("</section>", start) + "</section>".length);

// CSS: tokens, base, utilities and the page stylesheet; Tailwind classes from this section only.
const twDir = path.join(TOOLS, "tailwindcss");
const styles = path.join(ROOT, "src/styles");
async function loadStylesheet(id, base) {
  const resolved = id === "tailwindcss" ? path.join(twDir, "index.css") : path.resolve(base, id);
  return { path: resolved, base: path.dirname(resolved), content: fs.readFileSync(resolved, "utf8") };
}
const entry = ['@import "tailwindcss";', ...["fonts", "theme", "base", "utilities", "extras", "how-it-works-page"].map((f) => `@import "./${f}.css";`)].join("\n");
const compiler = await tailwind.compile(entry, { base: styles, loadStylesheet });
let css = compiler.build([...new Set((section + " www-site-type bg-background-base").split(/[\s"'`<>=]+/).filter((t) => t && t.length < 200))]);
css = css.replace(/url\("?\/fonts\/([^")]+)"?\)/g, (_, f) => `url("data:font/woff2;base64,${fs.readFileSync(path.join(ROOT, "public/fonts", f)).toString("base64")}")`);
css = css.replaceAll("top: 74px", `top: ${offset}px`).replaceAll("100svh - 74px", `100svh - ${offset}px`);

// JS: the section's script, as one inline module.
const scriptFile = { steps: "src/scripts/how-it-works/stages.ts", strips: "src/scripts/how-it-works/specialist-strips.ts" }[id];
let js = "";
if (scriptFile) {
  const result = await esbuild.build({ entryPoints: [path.join(ROOT, scriptFile)], bundle: true, format: "esm", target: "es2020", write: false, logLevel: "warning" });
  js = result.outputFiles[0].text.replace(/\b(const|var|let) HEADER_HEIGHT = 74;/g, `$1 HEADER_HEIGHT = ${offset};`);
}

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>handsdown — ${id} section</title>
<script>
  // Motion on/off before first paint (as in src/layouts/Base.astro).
  document.documentElement.dataset.motion = matchMedia("(prefers-reduced-motion: reduce)").matches ? "reduced" : "full";
</script>
<style>
${css}
</style>
</head>
<body class="www-site-type bg-background-base">
<main>
${section}
</main>
<script type="module">
${js}
</script>
</body>
</html>
`;
fs.writeFileSync(out, html);
console.log(`${out}  ${(html.length / 1024).toFixed(0)} KB`);
