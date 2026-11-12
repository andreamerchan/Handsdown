// Static preview builder for environments where `npm install` is not available.
//
// It renders an Astro page to plain HTML using a small subset of Astro's rules
// (frontmatter + JSX-like template, <slot />, set:html, component <script>
// imports), compiles Tailwind with a locally installed tailwindcss, and bundles
// the page scripts with esbuild. The output in dist-preview/ only uses relative
// paths, so it can be opened from any sub-folder or static host.
//
// Usage: node tools/preview/build.mjs [page=index] [--tools=/opt/npm-tools/node_modules]
// The real site is still built with `npm run build` (Astro). This is a preview aid only.

import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const toolsArg = process.argv.find((a) => a.startsWith("--tools="));
const TOOLS = toolsArg ? toolsArg.slice(8) : "/opt/npm-tools/node_modules";
const page = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "index";
const OUT = path.join(ROOT, "dist-preview");
const requireTools = createRequire(path.join(TOOLS, "noop.js"));
const esbuild = requireTools("esbuild");
const tailwind = await import(pathToFileURL(path.join(TOOLS, "tailwindcss/dist/lib.mjs")).href);

/* ---------------------------------------------------------------- Astro subset */

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);

/** Replace whitespace runs that contain a newline in *text* positions with {" "},
 *  so JSX keeps the single space that HTML (and Astro) would keep. */
function preserveTextWhitespace(src) {
  let out = "";
  const stack = ["text"];
  let i = 0;
  const top = () => stack[stack.length - 1];
  while (i < src.length) {
    const c = src[i];
    const mode = top();
    if (mode === "text") {
      if (c === "{") { stack.push("expr"); out += c; i++; continue; }
      if (c === "<") {
        if (src[i + 1] === "/") {
          const end = src.indexOf(">", i);
          out += src.slice(i, end + 1); i = end + 1;
          if (stack.length > 1) stack.pop();
          continue;
        }
        stack.push("tag"); out += c; i++; continue;
      }
      if (/\s/.test(c)) {
        let j = i;
        while (j < src.length && /\s/.test(src[j])) j++;
        const run = src.slice(i, j);
        out += run.includes("\n") ? '{" "}' : run;
        i = j; continue;
      }
      out += c; i++; continue;
    }
    if (mode === "tag") {
      if (c === '"' || c === "'") {
        const end = src.indexOf(c, i + 1);
        out += src.slice(i, end + 1); i = end + 1; continue;
      }
      if (c === "{") { stack.push("expr"); out += c; i++; continue; }
      if (c === "/" && src[i + 1] === ">") { stack.pop(); out += "/>"; i += 2; continue; }
      if (c === ">") { stack.pop(); stack.push("text"); out += c; i++; continue; }
      out += c; i++; continue;
    }
    // expr
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < src.length && src[j] !== c) { if (src[j] === "\\") j++; j++; }
      out += src.slice(i, j + 1); i = j + 1; continue;
    }
    if (c === "{") { stack.push("expr"); out += c; i++; continue; }
    if (c === "}") { stack.pop(); out += c; i++; continue; }
    if (c === "<" && /[A-Za-z>]/.test(src[i + 1] ?? "")) { stack.push("tag"); out += c; i++; continue; }
    out += c; i++;
  }
  return out;
}

function compileAstro(file) {
  const source = fs.readFileSync(file, "utf8");
  const match = source.match(/^---\n([\s\S]*?)\n---\n?/);
  const front = match ? match[1] : "";
  let template = match ? source.slice(match[0].length) : source;

  // Component scripts: collect their imports, drop the tag.
  const scripts = [];
  template = template.replace(/<script>([\s\S]*?)<\/script>/g, (_, body) => {
    for (const m of body.matchAll(/import\s+["']([^"']+)["']/g)) scripts.push(path.resolve(path.dirname(file), m[1]));
    return "";
  });
  const raws = [];
  template = template.replace(/<script is:inline>([\s\S]*?)<\/script>/g, (_, js) => {
    raws.push(`<script>${js}</script>`);
    return `{__raw(${JSON.stringify(raws.at(-1))})}`;
  });
  template = template
    .replace(/<!doctype html>/i, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<style>([\s\S]*?)<\/style>/g, (_, css) => { raws.push(`<style>${css}</style>`); return `{__raw(${JSON.stringify(raws.at(-1))})}`; })
    .replace(/<slot\s+name="([^"]+)"\s*\/>/g, '{__slots["$1"] ?? ""}')
    .replace(/<slot\s*\/>/g, '{__slots.default ?? ""}');
  template = preserveTextWhitespace(template.trim());

  const imports = [];
  const body = [];
  for (const line of front.split("\n")) {
    if (/^\s*import\s/.test(line)) {
      if (/\.css["']/.test(line)) continue;
      imports.push(line);
    } else body.push(line);
  }
  return `import { h, Fragment, __raw, __useScripts, __astro } from ${JSON.stringify(path.join(ROOT, "tools/preview/runtime.mjs"))};
${imports.join("\n")}
export default function Component(__props = {}, __slots = {}) {
  __useScripts(${JSON.stringify(scripts)});
  const Astro = { ...__astro, props: __props };
${body.join("\n")}
  return <>${template}</>;
}
`;
}

const astroPlugin = {
  name: "astro-subset",
  setup(build) {
    build.onResolve({ filter: /runtime\.mjs$/ }, (args) => ({ path: pathToFileURL(path.resolve(args.resolveDir, args.path)).href, external: true }));
    build.onLoad({ filter: /\.astro$/ }, (args) => ({ contents: compileAstro(args.path), loader: "tsx", resolveDir: path.dirname(args.path) }));
  },
};

/* ---------------------------------------------------------------- render HTML */

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const pageFile = path.join(ROOT, "src/pages", `${page}.astro`);
const ssr = await esbuild.build({
  entryPoints: [pageFile],
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
  jsx: "transform",
  jsxFactory: "h",
  jsxFragment: "Fragment",
  plugins: [astroPlugin],
  logLevel: "warning",
});
const ssrFile = path.join(OUT, "_ssr.mjs");
fs.writeFileSync(ssrFile, ssr.outputFiles[0].text);
const runtime = await import(pathToFileURL(path.join(ROOT, "tools/preview/runtime.mjs")).href);
const { default: Page } = await import(pathToFileURL(ssrFile).href + `?t=${Date.now()}`);
let html = "<!doctype html>\n" + String(Page({}, {}));
fs.rmSync(ssrFile);

/* ---------------------------------------------------------------- scripts */

const entry = runtime.collectedScripts().map((s) => `import ${JSON.stringify(s)};`).join("\n");
await esbuild.build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
  bundle: true,
  format: "esm",
  target: "es2020",
  minify: false,
  outfile: path.join(OUT, "site.js"),
  logLevel: "warning",
});

/* ---------------------------------------------------------------- css */

const twDir = path.join(TOOLS, "tailwindcss");
async function loadStylesheet(id, base) {
  let resolved;
  if (id === "tailwindcss") resolved = path.join(twDir, "index.css");
  else if (id.startsWith("tailwindcss/")) resolved = path.join(twDir, id.slice(12));
  else resolved = path.resolve(base, id);
  return { path: resolved, base: path.dirname(resolved), content: fs.readFileSync(resolved, "utf8") };
}
const cssEntry = path.join(ROOT, "src/styles/global.css");
const compiler = await tailwind.compile(fs.readFileSync(cssEntry, "utf8"), { base: path.dirname(cssEntry), loadStylesheet });
const scanText = html + walk(path.join(ROOT, "src/scripts")).concat(walk(path.join(ROOT, "src/motion"))).map((f) => fs.readFileSync(f, "utf8")).join("\n");
const candidates = new Set(scanText.split(/[\s"'`<>=]+/).filter((t) => t && t.length < 200));
let css = compiler.build([...candidates]);

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)],
  );
}

/* ---------------------------------------------------------------- relative paths + assets */

const relativize = (s) => s.replace(/(["'(\s,])\/(brand|fonts|media|favicon\.svg)/g, "$1$2");
html = relativize(html)
  .replace("</head>", `<link rel="stylesheet" href="site.css" />\n<script type="module" src="site.js"></script>\n</head>`)
  // Internal links have no pages in the preview; keep them on the page.
  .replace(/href="\/(?!\/)([^"]*)"/g, 'href="#$1"');
fs.writeFileSync(path.join(OUT, "index.html"), html);
css = relativize(css);
fs.writeFileSync(path.join(OUT, "site.css"), css);
fs.writeFileSync(path.join(OUT, "site.js"), relativize(fs.readFileSync(path.join(OUT, "site.js"), "utf8")));

// Copy only the public assets the page references.
const used = new Set();
for (const text of [html, css, fs.readFileSync(path.join(OUT, "site.js"), "utf8")])
  for (const m of text.matchAll(/(?:^|["'(\s,])((?:brand|fonts)\/[A-Za-z0-9_\-./]+\.[a-z0-9]+)/g)) used.add(m[1]);
for (const rel of used) {
  const src = path.join(ROOT, "public", rel);
  if (!fs.existsSync(src)) continue;
  fs.mkdirSync(path.dirname(path.join(OUT, rel)), { recursive: true });
  fs.copyFileSync(src, path.join(OUT, rel));
}
if (fs.existsSync(path.join(ROOT, "public/media"))) fs.cpSync(path.join(ROOT, "public/media"), path.join(OUT, "media"), { recursive: true });
fs.copyFileSync(path.join(ROOT, "public/favicon.svg"), path.join(OUT, "favicon.svg"));
console.log(`preview: ${path.relative(ROOT, OUT)}/index.html  (${used.size} assets)`);
