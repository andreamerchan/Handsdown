// /how-it-works: the chapter index marks the chapter you're reading (aria-current).
// No motion: it only follows the scroll position.

/** A chapter counts as "current" once its top passes this line (share of the viewport). */
const READING_LINE = 0.35;

const chapters = [...document.querySelectorAll<HTMLElement>("[data-chapter]")];
const links = new Map(
  [...document.querySelectorAll<HTMLAnchorElement>("[data-chapter-link]")].map((a) => [a.dataset.chapterLink, a]),
);

let frame = 0;
function update() {
  frame = 0;
  const line = innerHeight * READING_LINE;
  let current = chapters[0]?.id;
  for (const chapter of chapters) if (chapter.getBoundingClientRect().top <= line) current = chapter.id;
  links.forEach((link, id) => {
    if (id !== current) return link.removeAttribute("aria-current");
    if (link.hasAttribute("aria-current")) return;
    link.setAttribute("aria-current", "true");
    // Phones: the index is a horizontal strip; keep the current chapter in view.
    const strip = link.closest<HTMLElement>(".hiw-index");
    if (strip && strip.scrollWidth > strip.clientWidth) {
      strip.scrollLeft = link.offsetLeft - (strip.clientWidth - link.offsetWidth) / 2;
    }
  });
}
addEventListener("scroll", () => (frame ||= requestAnimationFrame(update)), { passive: true });
addEventListener("resize", () => (frame ||= requestAnimationFrame(update)));
update();
