// "How it works": the four steps, shared by the Home section and the dedicated page.
//
// Home tells the story in one line per step. The /how-it-works page uses the same
// steps, labels and headlines, then adds what happens, who does what, and what the
// client gets. Keep both in sync by editing this file, not the components.
//
// Source of truth: PRD 01 (hiring flow), 05 (Role Spec), 06 (talent hunt), 08 (check-ins),
// plus the Sept 24, 2026 update (the call is optional; the chat writes the Role Spec).
// No prices, headcounts, delivery times or guarantees here: none are settled.

export interface Step {
  id: string;
  /** Short label used by the step bar on Home and the rail on the page. */
  label: string;
  /** One line, as told on Home (also the page overview). */
  short: string;
  /** Page headline. Same message as the Home card, sometimes with the step's full scope. */
  title: string;
  lead: string;
  happens: string[];
  you: string[];
  we: string[];
  /** What the client has at the end of the step. */
  get: { title: string; body: string };
  note?: string;
}

export const STEPS: Step[] = [
  {
    id: "describe",
    label: "Describe",
    short: "You describe the role. We turn it into a spec.",
    title: "Describe the role. We turn it into a science-backed spec.",
    lead: "Start in the chat with whatever you know, even one line. It asks what it still needs, one question at a time, and writes your Role Spec.",
    happens: [
      "You describe the role, or the problem you need solved.",
      "The chat asks only what's missing: outcomes, skills, team, stack and hours.",
      "We write the Role Spec. Every line traces back to something you said, and the wording is checked for bias.",
      "Someone on our team reviews it before it reaches you.",
    ],
    you: ["Tell us what the role is for and what good looks like.", "Answer the follow-up questions. Skip what you don't know yet."],
    we: ["Ask the questions, one at a time.", "Write the spec and check every line.", "Review it before you see it."],
    get: {
      title: "Your Role Spec",
      body: "Yours to keep, whether or not you go ahead.",
    },
    note: "A job description says what the job is. A Role Spec says how you'll know someone can do it.",
  },
  {
    id: "align",
    label: "Align",
    short: "You approve the role. We start the search.",
    title: "We align on the role, then search across Latin America.",
    lead: "Nothing is published and no specialist is contacted until you approve the role. Then we search for people who match it.",
    happens: [
      "We go through the spec with you and fix anything that's off.",
      "Talk it through with your hiring partner if you'd like. The call is optional.",
      "You approve the role and the terms. That's the first time you commit to anything.",
      "We search our talent network, referrals and communities from Mexico to Argentina, and screen every candidate against your spec.",
    ],
    you: ["Read the spec and flag what's off.", "Approve the role and the terms."],
    we: [
      "Come to the call prepared. We've read the chat and only ask what it didn't answer.",
      "Run the search and screen every candidate against your must-haves.",
    ],
    get: {
      title: "An approved role",
      body: "The search starts from it, and every candidate is measured against it.",
    },
    note: "Your hiring partner is one person on our team. The same person stays with you after your specialist starts.",
  },
  {
    id: "match",
    label: "Match",
    short: "Every candidate goes through five checks.",
    title: "Every candidate goes through five checks.",
    lead: "The same questions and the same scale for everyone, so you compare people fairly and see the evidence behind every score.",
    happens: [],
    you: ["See the skills candidates will be rated on before anyone is scored.", "Tell us how you'd like to run your own interviews."],
    we: ["Run all five checks on every candidate.", "Write down the evidence behind every rating."],
    get: {
      title: "A scorecard per candidate",
      body: "A score for each skill in your spec, and the evidence behind it.",
    },
    note: "The fit check informs. It never outweighs skills.",
  },
  {
    id: "hire",
    label: "Hire",
    short: "You meet a shortlist and decide who joins.",
    title: "You meet a shortlist, not a pile of CVs.",
    lead: "Specialists who already said yes to your role, each scored against it. You interview, you decide, and we stay with you after they start.",
    happens: [
      "You get the shortlist, with a scorecard for each person.",
      "You interview the people you choose.",
      "You decide who joins. If no one fits, tell us why. We sharpen the spec and search again.",
      "We work out the offer with you, and your specialist starts inside your team.",
      "We check in at 30, 60 and 90 days.",
    ],
    you: ["Interview and decide.", "Lead their day-to-day work, like anyone on your team.", "Answer short check-ins at 30, 60 and 90 days."],
    we: ["Prepare the shortlist and the scorecards.", "Search again if no one fits.", "Stay with the engagement after the start."],
    get: {
      title: "A specialist on your team",
      body: "Working your hours, on your tools and priorities, with us checking in along the way.",
    },
    note: "Each check-in rates your specialist against the outcomes in your spec. The answers make our scoring better for every next hire.",
  },
];

/** Labels of the step bar on Home, in order. */
export const STEP_LABELS = STEPS.map((s) => s.label);

/** The five checks of step 3, as shown on Home, with what each tells you. */
export const CHECKS = [
  { name: "Skills screen", how: "Scored against your Role Spec", tells: "Whether they have the skills your spec weighs most." },
  { name: "Structured interview", how: "Same questions, fixed rating scale", tells: "How they've handled the situations your role will bring." },
  { name: "Work sample", how: "Real task, AI tools allowed", tells: "How they actually work, including how well they use AI: checking its output and catching its mistakes." },
  { name: "Fit check", how: "Work style and goals vs. your team", tells: "Whether they'll want to stay in this role, at this company." },
  { name: "Fairness check", how: "Scoring audited for bias before ranking", tells: "No ranking reaches a person until it has passed." },
];

/** What's inside the Role Spec (step 1 deliverable). */
export const SPEC_PARTS = [
  "Why the role exists",
  "What success looks like at 30, 60 and 90 days",
  "Must-have and nice-to-have skills, weighted",
  "How each skill will be tested",
  "Interview questions with a rating scale",
];

/** Step 4: from shortlist to the last check-in. */
export const AFTER_START = ["Shortlist", "Interviews", "Your decision", "Start", "Day 30", "Day 60", "Day 90"];
