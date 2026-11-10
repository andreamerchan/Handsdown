// Category pages (/hire/<category>): the dark "Role brief" panel beside the role cards
// follows the card the visitor last hovered or focused. It stays on that role afterwards.
// The page renders one brief per role, in the same order as the cards; all but one are hidden.

const section = document.querySelector("#specializations");
const cards = section?.querySelectorAll<HTMLElement>("ul > li:has(> h3)") ?? [];
const briefs =
  section?.querySelectorAll<HTMLElement>('aside[aria-label="Role brief"]') ??
  [];

function showBrief(index: number): void {
  briefs.forEach((brief, i) => {
    brief.hidden = i !== index;
  });
}

if (cards.length === briefs.length) {
  cards.forEach((card, index) => {
    card.addEventListener("pointerenter", () => showBrief(index));
    card.addEventListener("focusin", () => showBrief(index));
  });
}
