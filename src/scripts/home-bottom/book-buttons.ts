/**
 * Call-to-action buttons of the "Two ways to work with us" cards and of the
 * "How we work" steps.
 *
 * They carry data-jess: Jess's panel (public/_hd/jess-panel.js) opens on click
 * and stops the event first. Without her (script blocked), the buttons fall back
 * to the booking page, the assistant's own fallback destination.
 */

const BOOK_URL = "/book";

const buttons = document.querySelectorAll<HTMLButtonElement>(
  "[data-way] button, .www-hwws .www-hww-text > button",
);

buttons.forEach((button) => {
  button.addEventListener("click", () => window.location.assign(BOOK_URL));
});
