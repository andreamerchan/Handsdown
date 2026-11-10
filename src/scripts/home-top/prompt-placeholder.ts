// Hero prompt: the placeholder cycles through example roles, erasing the old
// example and typing the next one character by character. It waits while the
// visitor is using the field, and does not run with reduced motion.

const EXAMPLES = [
  "E.g. a senior RAG engineer, US-hours overlap",
  "E.g. two backend engineers for a fintech API",
  "E.g. a product designer to own our design system",
  "E.g. a data engineer who knows dbt and Snowflake",
];
const HOLD_MS = 2600; // how long a finished example stays
const BUSY_RETRY_MS = 2400; // re-check delay while the field is focused or filled
const ERASE_STEP_MS = 18;
const TYPE_STEP_MS = 34;

/** The placeholder texts to show, in order, to get from one example to the next. */
function typingSteps(from: string, to: string) {
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
  return { erasing, typing };
}

function cyclePlaceholder(input: HTMLInputElement) {
  let current = 0;

  const play = (steps: string[], stepMs: number, done: () => void) => {
    const [next, ...rest] = steps;
    if (next === undefined) return done();
    input.placeholder = next;
    setTimeout(() => play(rest, stepMs, done), stepMs);
  };

  const showNext = () => {
    if (document.activeElement === input || input.value) {
      setTimeout(showNext, BUSY_RETRY_MS);
      return;
    }
    const next = (current + 1) % EXAMPLES.length;
    const { erasing, typing } = typingSteps(EXAMPLES[current], EXAMPLES[next]);
    play(erasing, ERASE_STEP_MS, () =>
      play(typing, TYPE_STEP_MS, () => {
        current = next;
        setTimeout(showNext, HOLD_MS);
      }),
    );
  };

  setTimeout(showNext, HOLD_MS);
}

const promptInput = document.querySelector<HTMLInputElement>(
  '.www-net-hero .www-net-words input[type="text"]',
);
if (promptInput && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
  cyclePlaceholder(promptInput);
}
