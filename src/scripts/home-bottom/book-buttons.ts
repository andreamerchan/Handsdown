/**
 * Call-to-action buttons of the "Two ways to work with us" cards and of the
 * "How we work" steps.
 *
 * On the original site these open the Smart Match chat assistant, an external
 * widget that is not part of this project. Until it is embedded here, the
 * buttons take the visitor to the booking page, which is the assistant's own
 * fallback destination.
 */

const BOOK_URL = "/book";

const buttons = document.querySelectorAll<HTMLButtonElement>(
  "[data-way] > button, .www-hwws .www-hww-text > button",
);

buttons.forEach((button) => {
  button.addEventListener("click", () => window.location.assign(BOOK_URL));
});
