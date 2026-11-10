// Hire pages hand a role over to the booking page as /book?role=<text>, like the site-wide
// "describe your role" prompts do (src/scripts/site/prompts.ts).
// (The original site opened its "Smart Match" chat here; the rebuilt site books a call instead.)

import { promptDestination } from "../../data/site";

/** Go to the booking page, carrying the role the visitor asked for. */
export function openBooking(role: string): void {
  const text = role.trim();
  window.location.assign(
    text === ""
      ? promptDestination
      : `${promptDestination}?role=${encodeURIComponent(text)}`,
  );
}

// Buttons for something that has no page of its own to link to (a role without a role
// page, a sample talent profile) name their role in `data-book-role`.
for (const button of document.querySelectorAll<HTMLElement>(
  "[data-book-role]",
)) {
  button.addEventListener("click", () =>
    openBooking(button.dataset.bookRole ?? ""),
  );
}
