// Cost estimator on /pricing ("Know the range up front").
// Choosing a discipline or a seniority recalculates the two bars, the amounts,
// the "What you keep" note and the sentence announced to screen readers.
// The numbers and the formula live in src/data/pricing.ts.

import {
  DEFAULT_DISCIPLINE,
  DEFAULT_SENIORITY,
  describeEstimate,
  estimateFor,
  type BarView,
} from "../../data/pricing";
import { openBooking } from "./open-booking";

const section = document.querySelector<HTMLElement>('section[aria-labelledby="cost-estimator"]');
const disciplineSelect = section?.querySelector<HTMLSelectElement>("select");
const seniorityRadios = section?.querySelectorAll<HTMLInputElement>('input[name="estimate-seniority"]');

if (section && disciplineSelect && seniorityRadios?.length) {
  // The card shows two rows, ours first and the US in-house hire second.
  // Each row has an amount (".tabular-nums") and a bar track (".h-10") holding
  // a solid segment up to the low amount and a faded segment up to the high one.
  const amounts = section.querySelectorAll<HTMLElement>(".tabular-nums");
  const tracks = section.querySelectorAll<HTMLElement>(".h-10.overflow-hidden");
  const keepNote = section.querySelector<HTMLElement>('[style*="--keep-at"]');
  const keepShare = keepNote?.querySelector<HTMLElement>(".font-semibold");
  const keepYearly = keepNote?.querySelector<HTMLElement>(".text-text-secondary");
  const announcement = section.querySelector<HTMLElement>('[aria-live="polite"]');

  const renderRow = (index: number, bar: BarView) => {
    // The amount is the first text node; the "/ mo*" suffix after it stays as is.
    const amountText = amounts[index]?.firstChild;
    if (amountText) amountText.textContent = bar.amount;

    const [solid, faded] = tracks[index]?.querySelectorAll<HTMLElement>("span") ?? [];
    if (solid) solid.style.width = `${bar.lowPercent}%`;
    if (faded) {
      faded.style.left = `${bar.lowPercent}%`;
      faded.style.width = `${bar.spreadPercent}%`;
    }
  };

  // The page is rendered with the default selection; the bars are only
  // redrawn when the newly selected combination has different amounts.
  let shownAmounts = JSON.stringify(estimateFor(DEFAULT_DISCIPLINE, DEFAULT_SENIORITY));

  const render = () => {
    const discipline = disciplineSelect.value;
    const seniority = [...seniorityRadios].find((radio) => radio.checked)?.value ?? "";
    const view = describeEstimate(discipline, seniority);

    // The announcement names the selection, so it changes every time.
    if (announcement) announcement.textContent = view.announcement;

    const amountsToShow = JSON.stringify(estimateFor(discipline, seniority));
    if (amountsToShow === shownAmounts) return;
    shownAmounts = amountsToShow;

    renderRow(0, view.ours);
    renderRow(1, view.usInHouse);
    keepNote?.style.setProperty("--keep-at", `${view.keepOffsetPercent}%`);
    if (keepShare) keepShare.textContent = view.keepShare;
    if (keepYearly) keepYearly.textContent = view.keepYearly;
  };

  disciplineSelect.addEventListener("change", render);
  seniorityRadios.forEach((radio) => radio.addEventListener("change", render));
  // Browsers can restore a previous selection on reload or back navigation.
  window.addEventListener("pageshow", render);

  // "Describe your role" under the bars.
  section
    .querySelector<HTMLButtonElement>('button[type="button"]')
    ?.addEventListener("click", openBooking);
}
