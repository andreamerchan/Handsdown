// "Leverage world-class talent" cards: a soft spotlight follows the mouse.
// The CSS draws it at (--mx, --my) inside the card while the card is hovered.

for (const card of document.querySelectorAll<HTMLElement>(".www-talent-card")) {
  card.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse") return;
    const box = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${event.clientX - box.left}px`);
    card.style.setProperty("--my", `${event.clientY - box.top}px`);
  });
}
