/**
 * Hero of /how-it-works: the placeholder of the "describe the role" field
 * cycles through example requests. The current example is erased back to the
 * part it shares with the next one, then the next one is typed out.
 *
 * It pauses while the field has focus or text, and does not run at all with
 * reduced motion.
 */

const EXAMPLES = [
  "E.g. a senior RAG engineer, US-hours overlap",
  "E.g. two backend engineers for a fintech API",
  "E.g. a product designer to own our design system",
  "E.g. a data engineer who knows dbt and Snowflake",
];

/** How long a finished example stays before the next one starts. */
const HOLD_MS = 2600;
/** How soon to check again while the visitor is using the field. */
const BUSY_RETRY_MS = 2400;
const ERASE_MS_PER_CHARACTER = 18;
const TYPE_MS_PER_CHARACTER = 34;

const field = document.querySelector<HTMLInputElement>(
  "form.www-ask-glow input",
);
const reducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

if (field && !reducedMotion) {
  cyclePlaceholder(field);
}

function cyclePlaceholder(field: HTMLInputElement): void {
  let current = 0;

  /** Shows the given placeholder texts one after another, then calls `done`. */
  const showInTurn = (texts: string[], interval: number, done: () => void) => {
    const [text, ...rest] = texts;
    if (text === undefined) return done();
    field.placeholder = text;
    window.setTimeout(() => showInTurn(rest, interval, done), interval);
  };

  const next = () => {
    if (document.activeElement === field || field.value) {
      window.setTimeout(next, BUSY_RETRY_MS);
      return;
    }
    const upcoming = (current + 1) % EXAMPLES.length;
    const from = EXAMPLES[current];
    const to = EXAMPLES[upcoming];

    let shared = 0;
    while (
      shared < from.length &&
      shared < to.length &&
      from[shared] === to[shared]
    ) {
      shared++;
    }
    const erasing: string[] = [];
    for (let length = from.length - 1; length >= shared; length--) {
      erasing.push(from.slice(0, length));
    }
    const typing: string[] = [];
    for (let length = shared + 1; length <= to.length; length++) {
      typing.push(to.slice(0, length));
    }

    showInTurn(erasing, ERASE_MS_PER_CHARACTER, () =>
      showInTurn(typing, TYPE_MS_PER_CHARACTER, () => {
        current = upcoming;
        window.setTimeout(next, HOLD_MS);
      }),
    );
  };

  window.setTimeout(next, HOLD_MS);
}
