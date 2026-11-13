/**
 * Motion tokens: the one place to tune the home page's movement.
 *
 * Every value here is also exposed to CSS as a custom property on <html>
 * (see `applyMotionTokens` in core.ts), e.g. `durations.focus` -> `--m-dur-focus`.
 * Change a number here and both the scripts and the stylesheet follow.
 *
 * The motion language is "Enfoque" (blur -> focus): things start vague and
 * become precise, the way a one-line request becomes a specific person on
 * the visitor's team. Blur is only used where it means "becoming clear".
 */

export const durations = {
  /** Hover and press feedback. */
  micro: 160,
  /** Small state changes (badges, chips). */
  short: 320,
  /** Default entrance of an element. */
  base: 620,
  /** A headline or photo coming into focus. */
  focus: 1100,
  /** Lines that draw across a section. */
  draw: 1400,
} as const;

export const easings = {
  /** Brand ease: fast start, long soft landing. Matches --ease-brand-out. */
  out: "cubic-bezier(0.16, 1, 0.3, 1)",
  /** Symmetric, for things that travel between two places. */
  inOut: "cubic-bezier(0.65, 0, 0.35, 1)",
  standard: "cubic-bezier(0.4, 0, 0.2, 1)",
} as const;

/** Blur radii (px) of the "out of focus" state. */
export const blur = {
  headline: 14,
  photo: 22,
  value: 6,
} as const;

/** Delays between items of a group (ms). */
export const stagger = {
  line: 150,
  word: 40,
  card: 140,
  chip: 60,
} as const;

/** Distances (px) for rises and offsets. */
export const distance = {
  rise: 16,
  heroExitLift: 48,
} as const;

/** Scroll choreography. Values are fractions of the viewport height or of a section's progress. */
export const scroll = {
  /** How much the hero globe shrinks and fades while the hero scrolls away. */
  heroExitScale: 0.07,
  heroExitFade: 0.6,
  /** Step 1 of "How we work": share of the step's scroll range used by the sentence -> spec sequence. */
  specSequenceShare: 0.8,
  /** Same sequence, played on a timer on small screens (ms). */
  specSequenceAutoplay: 3600,
  /** Shortlist -> team photo hand-off: it starts when the target card is this far below the fold... */
  handoffLead: 0.3,
  /** ...and lands when the card's top reaches this point of the viewport. */
  handoffLandAt: 0.52,
  /** "A partner for the whole engagement": the line draws while the section moves between these points. */
  commitmentsFrom: 0.85,
  commitmentsTo: 0.4,
  /**
   * "How we work" step text, scrubbed by scroll. Positions are in step units
   * (0 = the step starts, 1 = the next step starts); rise/lift/blur in px.
   */
  stepText: {
    stagger: 0.026,
    rise: 46,
    lift: 34,
    blur: 8,
    /** Step 1 comes in while the stage scrolls into place. */
    firstEnter: [-0.55, -0.1] as const,
    enter: [-0.1, 0.08] as const,
    exit: [0.7, 0.86] as const,
  },
} as const;

/** Screen sizes. Cross-section flights need room; below this they are skipped. */
export const breakpoints = {
  flight: 900,
} as const;

export const tokens = { durations, easings, blur, stagger, distance, scroll, breakpoints };
