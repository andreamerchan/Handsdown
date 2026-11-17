// "How it works": the four steps, shared by the Home section and the /how-it-works page.
//
// Home tells each step in one card. The page uses the same steps, labels and headlines,
// then splits the detail into short sections (checks, deliverables, who does what,
// after the start). Keep copy short: a few words per line, three points per step at most.
//
// Source of truth: PRD 01 (hiring flow), 05 (Role Spec), 06 (talent hunt), 08 (check-ins),
// plus the Sept 24, 2026 update (the call is optional; the chat writes the Role Spec).
// No prices, headcounts, delivery times or guarantees here: none are settled.

export interface Step {
  id: string;
  /** Short label used by the step bar on Home and the page. */
  label: string;
  /** Headline: the same message as the Home card. */
  title: string;
  /** Three short points. */
  points: string[];
  you: string;
  we: string;
  /** The deliverable of this step. */
  get: string;
}

export const STEPS: Step[] = [
  {
    id: "describe",
    label: "Describe",
    title: "Describe the role. We turn it into a science-backed spec.",
    points: ["Start with one line", "The chat asks what's missing", "A person reviews your spec"],
    you: "Describe the need",
    we: "Write the spec",
    get: "Your Role Spec",
  },
  {
    id: "align",
    label: "Align",
    title: "You approve. We search across Latin America.",
    points: ["Fix anything that's off", "Call optional", "Nothing goes out until you approve"],
    you: "Approve role and terms",
    we: "Search and screen",
    get: "An approved role",
  },
  {
    id: "match",
    label: "Match",
    title: "Every candidate goes through five checks.",
    points: ["Same checks for everyone", "Evidence behind every score", "Bias audited before ranking"],
    you: "See the criteria",
    we: "Run the five checks",
    get: "A scorecard per candidate",
  },
  {
    id: "hire",
    label: "Hire",
    title: "You meet a shortlist, not a pile of CVs.",
    points: ["Interview who you choose", "No fit? We search again", "You decide who joins"],
    you: "Interview and decide",
    we: "Shortlist and check in",
    get: "A specialist on your team",
  },
];

/** Labels of the step bar on Home, in order. */
export const STEP_LABELS = STEPS.map((s) => s.label);

/** The five checks of step 3 (same names as Home), with what each one shows. */
export const CHECKS = [
  { name: "Skills screen", tells: "The skills your spec weighs most" },
  { name: "Structured interview", tells: "Same questions, same scale" },
  { name: "Work sample", tells: "A real task, AI tools allowed" },
  { name: "Fit check", tells: "Will they want to stay?" },
  { name: "Fairness check", tells: "Bias audited before ranking" },
];

/** What's inside the Role Spec. */
export const SPEC_PARTS = ["Why the role exists", "Success at 30, 60, 90 days", "Weighted skills", "How each skill is tested"];

/** Before the search starts. */
export const ALIGN_GATES = [
  { name: "Spec reviewed", state: "done" },
  { name: "Call", state: "optional" },
  { name: "Role and terms approved", state: "done" },
  { name: "Search starts", state: "next" },
];

/** How the specialist works with you. */
export const ON_YOUR_TEAM = ["Your hours", "Your tools", "Your lead"];

/** Step 4: from shortlist to the last check-in. */
export const AFTER_START = ["Shortlist", "Interviews", "Start", "Day 30", "Day 60", "Day 90"];
