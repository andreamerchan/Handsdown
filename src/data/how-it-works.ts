// "How it works": shared by the Home section (step labels) and the /how-it-works page.
//
// Home tells the four steps in one card each. The page explains the whole process once,
// chapter by chapter: what happens, how candidates are evaluated, and how quality is kept
// after the start. Each fact appears in one place only.
//
// Source of truth: PRD 01 (hiring flow), 05 (role spec), 06 (talent hunt), 08 (check-ins and
// validation), plus the Sept 24, 2026 update (the call is optional; the chat writes the spec).
// Nothing here that the PRDs don't back: no prices, headcounts, delivery times or guarantees.

export interface Chapter {
  id: string;
  /** Step label (the first four match the Home step bar). */
  label: string;
  title: string;
  intro: string;
  /** What happens, in order. */
  steps?: string[];
  /** The client's part, in one line. */
  yours?: string;
}

export const STEPS: Chapter[] = [
  {
    id: "describe",
    label: "Describe",
    title: "First, we define what “qualified” means for your role.",
    intro:
      "You describe the role in a short chat. We turn it into a written spec: the bar every candidate will be measured against, before we look at a single CV.",
    yours: "Describe the need and answer a few follow-up questions. Skip what you don't know yet.",
  },
  {
    id: "align",
    label: "Align",
    title: "Nothing moves until you approve.",
    intro: "No specialist is contacted and nothing is published until you've approved the role and the terms.",
    steps: [
      "We go through the spec with you and fix anything that's off.",
      "If you'd like a call, your hiring partner joins prepared: they've read the chat and only ask what it didn't answer. The call is optional.",
      "You see exactly which skills candidates will be rated on, before anyone is scored.",
      "You approve the role and the terms. That's the first time you commit to anything.",
      "We search our talent network, referrals and communities from Mexico to Argentina.",
    ],
    yours: "Review the spec, approve the role and the terms.",
  },
  {
    id: "match",
    label: "Match",
    title: "Every candidate goes through the same five checks.",
    intro:
      "Same questions, same scale, scored against your spec. Nobody reaches your shortlist on a CV or a good conversation alone.",
    yours: "Nothing. This part is ours.",
  },
  {
    id: "hire",
    label: "Hire",
    title: "You meet a shortlist, not a pile of CVs.",
    intro: "Only specialists who passed all five checks and already said yes to your role.",
    steps: [
      "You get the shortlist, with a scorecard for each person.",
      "You interview the people you choose and decide who joins.",
      "If no one fits, tell us why. We record your reasons, sharpen the spec and search again.",
      "We work out the offer with you, and your specialist starts inside your team: your hours, your tools, your priorities.",
    ],
    yours: "Interview, decide, and lead their day-to-day work like anyone on your team.",
  },
];

/** Labels of the step bar on Home, in order. */
export const STEP_LABELS = STEPS.map((s) => s.label);

/** What the spec defines (chapter 1). */
export const SPEC_PARTS = [
  { name: "Why the role exists", body: "The mission, in one or two lines." },
  { name: "What success looks like", body: "Concrete outcomes at 30, 60 and 90 days." },
  { name: "The skills that matter", body: "Must-haves and nice-to-haves, each with a weight." },
  { name: "How each skill is tested", body: "The interview questions and the work sample that will prove it." },
];

/** How the spec itself is checked before it reaches you (chapter 1). */
export const SPEC_QUALITY = [
  "Every line traces back to something you told us.",
  "The wording is checked for bias.",
  "A person on our team reviews it before you see it.",
];

/** The five checks (chapter 3), in the order Home shows them. */
export const CHECKS = [
  {
    name: "Skills screen",
    what: "Every candidate is scored against the skills in your spec, weighted the way you agreed.",
    bar: "Missing a must-have ends it, whatever the total. Below the match bar, nobody moves on.",
  },
  {
    name: "Structured interview",
    what: "The same questions for everyone, built from your spec. Each answer is rated on a scale where every level is described by what the person actually did.",
    bar: "Every rating needs written evidence. An interview can't be submitted until every question is rated.",
  },
  {
    name: "Work sample",
    what: "A real task from the role, scored on the same scale. AI tools are allowed: we look at how they use them, checking the output and catching its mistakes.",
    bar: "On for every candidate. Skipping it needs a written reason on file.",
  },
  {
    name: "Fit check",
    what: "Work style, values and goals, compared with what your team and the role really offer.",
    bar: "Tells you whether they'll want to stay. It informs the decision; it never outweighs skills.",
  },
  {
    name: "Fairness check",
    what: "Before any ranking reaches a person, the scores are checked for bias across groups.",
    bar: "If something looks off, the ranking is frozen until it's investigated.",
  },
];

/** After the start (chapter 5). */
export const AFTER_START = [
  {
    name: "The same partner",
    body: "Your hiring partner stays with you after the start. You always know who to call.",
  },
  {
    name: "Check-ins at 30, 60 and 90 days",
    body: "A two-minute review that rates your specialist against the outcomes you set in the spec. The bar was agreed before hiring, not invented after.",
  },
  {
    name: "Scoring that learns",
    body: "We compare what we scored with how each specialist actually performs, and adjust how we evaluate, with evidence. Every next hire benefits.",
  },
];

export const FAQ = [
  { q: "Why don’t I see profiles right away?", a: "We only introduce people who passed all five checks and already said yes to your role." },
  { q: "What if the role is hard to describe?", a: "Start with one line. The chat asks the rest." },
  { q: "What if I decide not to go ahead?", a: "Keep the spec. It’s yours either way." },
];
