// "How it works": shared by the Home section (step labels) and the /how-it-works page.
//
// The page: the four steps first, then one section each for vetting, quality assurance and
// after the start. Short lines only: a headline and a few words per item; the visuals carry
// the rest.
//
// Source of truth: PRD 01 (hiring flow), 05 (role spec), 06 (talent hunt), 08 (check-ins and
// validation), plus the Sept 24, 2026 update (the call is optional; the chat writes the spec).
// Nothing here that the PRDs don't back: no prices, headcounts, delivery times or guarantees.

export const STEPS = [
  { id: "describe", label: "Describe", title: "Tell us what you need.", body: "A short chat. We turn it into a written spec, free." },
  { id: "align", label: "Align", title: "You approve. Then we search.", body: "Nothing goes out until you approve the role and the terms." },
  { id: "match", label: "Match", title: "Five checks for everyone.", body: "Every candidate is scored against your spec." },
  { id: "hire", label: "Hire", title: "Meet a shortlist. You decide.", body: "Only people who passed and said yes to your role." },
];

/** Labels of the step bar on Home, in order. */
export const STEP_LABELS = STEPS.map((s) => s.label);

/** Vetting: the five checks, in the order Home shows them. */
export const CHECKS = [
  { name: "Skills screen", line: "Scored against your spec. Missing a must-have ends it." },
  { name: "Structured interview", line: "Same questions for everyone, rated with evidence." },
  { name: "Work sample", line: "A real task from the role. AI tools allowed." },
  { name: "Fit check", line: "Will they want to stay? It never outweighs skills." },
  { name: "Fairness check", line: "Scores audited for bias before any ranking." },
];

/** Quality assurance. */
export const QUALITY = [
  { name: "Measured against your bar", line: "The spec you approved is the standard for every candidate." },
  { name: "Evidence behind every score", line: "Interview notes and the work sample, not gut feeling." },
  { name: "Reviewed by people", line: "Your spec and every interview go through our team." },
  { name: "No fit? We search again", line: "Tell us why. We sharpen the spec and start over." },
];

/** After the start. */
export const AFTER_START = [
  { name: "The same partner", line: "One person who knows your role, from the first call on." },
  { name: "30, 60 and 90-day check-ins", line: "Rated against the outcomes in your spec." },
  { name: "Scoring that learns", line: "Real performance sharpens every next match." },
];

export const FAQ = [
  { q: "Why don’t I see profiles right away?", a: "We only introduce people who passed all five checks and already said yes to your role." },
  { q: "What if the role is hard to describe?", a: "Start with one line. The chat asks the rest." },
  { q: "What if I decide not to go ahead?", a: "Keep the spec. It’s yours either way." },
];
