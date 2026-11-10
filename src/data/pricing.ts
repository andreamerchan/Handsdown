// Pricing data for the cost estimator on /pricing ("Know the range up front").
// Used twice: by CostEstimator.astro to render the default state, and by
// src/scripts/pricing/cost-estimator.ts to update the card when a control changes.
// All amounts are US dollars per month for a full-time engagement.

export interface Range {
  low: number;
  high: number;
}

export interface Estimate {
  /** What the specialist costs through Handsdown. */
  ours: Range;
  /** What the same hire costs in-house in the US, fully loaded. */
  usInHouse: Range;
}

export const DISCIPLINES = [
  { id: "eng", label: "Engineering" },
  { id: "ai", label: "AI & Data" },
  { id: "data", label: "Data & Analytics" },
  { id: "design", label: "Design" },
  { id: "product", label: "Product" },
] as const;

export const SENIORITIES = [
  { id: "senior", label: "Senior" },
  { id: "staff", label: "Staff" },
] as const;

export type DisciplineId = (typeof DISCIPLINES)[number]["id"];
export type SeniorityId = (typeof SENIORITIES)[number]["id"];

export const DEFAULT_DISCIPLINE: DisciplineId = "eng";
export const DEFAULT_SENIORITY: SeniorityId = "staff";

/** The range shown for every discipline and seniority that has no entry below. */
export const BASE_ESTIMATE: Estimate = {
  ours: { low: 7500, high: 10000 },
  usInHouse: { low: 17000, high: 20500 },
};

/**
 * Per-combination ranges, keyed "<discipline id>:<seniority id>".
 * The site currently shows the same range for every combination, so this is empty.
 * Example: "ai:staff": { ours: { low: 9000, high: 12000 }, usInHouse: { low: 19000, high: 23000 } }
 */
export const ESTIMATE_OVERRIDES: Partial<
  Record<`${DisciplineId}:${SeniorityId}`, Estimate>
> = {};

export function estimateFor(discipline: string, seniority: string): Estimate {
  const key = `${discipline}:${seniority}` as keyof typeof ESTIMATE_OVERRIDES;
  return ESTIMATE_OVERRIDES[key] ?? BASE_ESTIMATE;
}

// --- Everything the card displays, derived from one estimate ---------------

/** The longest bar stops at 90% of the track, so the scale is the top amount / 0.9. */
const BAR_FILL_AT_TOP_AMOUNT = 0.9;
/** The "What you keep" note sits under the end of our bar, but never further right than this. */
const KEEP_NOTE_MAX_OFFSET_PERCENT = 60;

const dollars = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export interface BarView {
  /** "$7,500 – $10,000" */
  amount: string;
  /** Width of the solid part of the bar (0 to the low amount), in % of the track. */
  lowPercent: number;
  /** Width of the faded part of the bar (low to high amount), in % of the track. */
  spreadPercent: number;
}

export interface EstimateView {
  ours: BarView;
  usInHouse: BarView;
  /** Left offset of the "What you keep" note, in % (applied from the sm breakpoint up). */
  keepOffsetPercent: number;
  /** "41–63% " */
  keepShare: string;
  /** "· about $120,000 a year" */
  keepYearly: string;
  /** Sentence read out by screen readers when the selection changes. */
  announcement: string;
}

function barView(range: Range, scale: number): BarView {
  const lowPercent = (range.low / scale) * 100;
  const highPercent = (range.high / scale) * 100;
  return {
    amount: `${dollars.format(range.low)} – ${dollars.format(range.high)}`,
    lowPercent,
    spreadPercent: highPercent - lowPercent,
  };
}

function spokenRange(range: Range): string {
  return `${dollars.format(range.low)} to ${dollars.format(range.high)}`;
}

export function describeEstimate(
  discipline: string,
  seniority: string,
): EstimateView {
  const { ours, usInHouse } = estimateFor(discipline, seniority);
  const scale = Math.max(usInHouse.high, ours.high) / BAR_FILL_AT_TOP_AMOUNT;
  const midpoint = (range: Range) => (range.low + range.high) / 2;

  // Savings: worst case (our high vs their low) to best case (our low vs their high).
  const lowShare = Math.round((1 - ours.high / usInHouse.low) * 100);
  const highShare = Math.round((1 - ours.low / usInHouse.high) * 100);
  // Yearly saving between the two midpoints, rounded to the nearest $1,000.
  const yearly =
    1000 * Math.round(((midpoint(usInHouse) - midpoint(ours)) * 12) / 1000);

  const disciplineLabel =
    DISCIPLINES.find((d) => d.id === discipline)?.label ?? "";
  const seniorityLabel =
    SENIORITIES.find((s) => s.id === seniority)?.label ?? "";

  return {
    ours: barView(ours, scale),
    usInHouse: barView(usInHouse, scale),
    keepOffsetPercent: Math.min(
      (ours.high / scale) * 100,
      KEEP_NOTE_MAX_OFFSET_PERCENT,
    ),
    keepShare: `${lowShare}–${highShare}% `,
    keepYearly: `· about ${dollars.format(yearly)} a year`,
    announcement:
      `${seniorityLabel} ${disciplineLabel}: ${spokenRange(ours)} a month with Handsdown, ` +
      `against ${spokenRange(usInHouse)} for a US in-house hire.`,
  };
}
