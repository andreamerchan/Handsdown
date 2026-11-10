/**
 * "The right specialist closes the gap." on /how-it-works (`.www-stw`).
 *
 * The words fade in one after another the first time the band scrolls into
 * view. Each word carries its own delay and duration (`--stw-d`, `--stw-t`);
 * this script only flips two switches on the section:
 *
 * - `data-armed`: hides the words (only set when the script runs, so the text
 *   stays readable without JavaScript);
 * - `data-shown`: starts the sequence. With reduced motion the CSS shows the
 *   words at once.
 */

/** How much of the band must be visible before the words start. */
const VISIBLE_RATIO = 0.4;
/** The bottom tenth of the screen does not count as "visible". */
const VIEWPORT_MARGIN = "0px 0px -10% 0px";

/** The "Find Talent" button starts a request without any text. */
const BOOKING_URL = "/book";

const band = document.querySelector<HTMLElement>(".www-stw");

if (band) {
  band.dataset.armed = "";

  const watcher = new IntersectionObserver(
    ([entry]) => {
      if (!entry?.isIntersecting) return;
      band.dataset.shown = "";
      watcher.disconnect();
    },
    { threshold: VISIBLE_RATIO, rootMargin: VIEWPORT_MARGIN },
  );
  watcher.observe(band);

  band
    .querySelector("button")
    ?.addEventListener("click", () => window.location.assign(BOOKING_URL));
}
