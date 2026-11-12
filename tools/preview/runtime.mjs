// Tiny JSX-to-HTML runtime used by tools/preview/build.mjs.

class Html {
  constructor(value) { this.value = value; }
  toString() { return this.value; }
}

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const escapeText = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;");

function renderChildren(children) {
  let out = "";
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false || child === true) continue;
    out += child instanceof Html ? child.value : escapeText(child);
  }
  return out;
}

export const Fragment = Symbol("Fragment");
export const __raw = (s) => new Html(s);
export const __astro = {
  url: new URL("https://handsdown.io/"),
  site: new URL("https://handsdown.io"),
};

const scripts = [];
export function __useScripts(list) {
  for (const s of list) if (!scripts.includes(s)) scripts.push(s);
}
export const collectedScripts = () => scripts;

export function h(tag, props, ...children) {
  props = props ?? {};
  if (tag === Fragment) return new Html(renderChildren(children));
  if (typeof tag === "function") {
    const slots = {};
    const rest = children.flat(Infinity);
    slots.default = new Html(renderChildren(rest));
    return new Html(String(tag(props, slots)));
  }
  let attrs = "";
  let inner = null;
  for (const [key, value] of Object.entries(props)) {
    if (key === "set:html") { inner = String(value); continue; }
    if (value == null || value === false) continue;
    attrs += value === true ? ` ${key}` : ` ${key}="${escapeAttr(value)}"`;
  }
  if (VOID.has(tag)) return new Html(`<${tag}${attrs} />`);
  return new Html(`<${tag}${attrs}>${inner ?? renderChildren(children)}</${tag}>`);
}
