// Role pages: the prompt builder above the skills grid.
//
// The prompt field starts with a few example job titles as chips. The visitor can
// - remove a title chip by clicking it,
// - pick skills from the grid below: each picked skill gets a check badge and a chip in the prompt
//   (clicking the chip or the skill again un-picks it),
// - press Backspace in the empty text field to drop the last chip,
// - narrow the grid to one skill group with the tabs (picked skills stay picked),
// - type anything else and submit: titles, skills and typed text are combined into one sentence,
//   e.g. "Senior UX designer or UX architect with Figma and FigJam. Starting in May".

import { openBooking } from "./booking";

const ALL_GROUPS = "All";

// Classes swapped when a skill card is picked / a group tab is selected.
const SKILL_PICKED = ["border-text-primary"];
const SKILL_IDLE = ["border-border-default", "hover:border-border-focus"];
const TAB_SELECTED = ["bg-background-inverted", "text-text-inverse-primary"];
const TAB_IDLE = [
  "text-text-secondary",
  "hover:bg-background-neutral-subtle",
  "hover:text-text-primary",
];

function swapClasses(
  element: Element,
  on: boolean,
  whenOn: string[],
  whenOff: string[],
): void {
  element.classList.remove(...(on ? whenOff : whenOn));
  element.classList.add(...(on ? whenOn : whenOff));
}

/** "a", "a and b", "a, b and c" (or with "or"). */
function joinList(items: string[], lastJoiner: string): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} ${lastJoiner} ${items[items.length - 1]}`;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function setUpBuilder(root: HTMLElement): void {
  const form = root.querySelector("form");
  const input = form?.querySelector<HTMLInputElement>('input[type="text"]');
  const titleList = root.querySelector<HTMLElement>(
    'ul[aria-label="Role titles"]',
  );
  const chosenList = root.querySelector<HTMLElement>(
    'ul[aria-label="Chosen technologies"]',
  );
  const chipTemplate = root.querySelector<HTMLTemplateElement>(
    "template[data-skill-chip]",
  );
  const checkTemplate = root.querySelector<HTMLTemplateElement>(
    "template[data-skill-check]",
  );
  if (
    !form ||
    !input ||
    !titleList ||
    !chosenList ||
    !chipTemplate ||
    !checkTemplate
  )
    return;

  const askedAs = root.dataset.askedAs ?? "";
  const skillCards = [...root.querySelectorAll<HTMLElement>("li[data-skill]")];
  const tabs = [...root.querySelectorAll<HTMLElement>('[role="tab"]')];

  // The chips in the prompt are the state: read them back whenever it is needed.
  const chipLabel = (chip: Element) =>
    chip.querySelector("button")?.firstChild?.textContent?.trim() ?? "";
  const titles = () => [...titleList.children].map(chipLabel);
  const pickedSkills = () => [...chosenList.children].map(chipLabel);

  // --- Title chips: click to remove -------------------------------------------------------
  titleList.addEventListener("click", (event) => {
    (event.target as Element).closest("li")?.remove();
  });

  // --- Skills: pick / un-pick -------------------------------------------------------------
  function toggleSkill(skill: string): void {
    const card = skillCards.find((item) => item.dataset.skill === skill);
    const button = card?.querySelector("button");
    if (!button) return;

    const existingChip = [...chosenList.children].find(
      (chip) => chipLabel(chip) === skill,
    );
    const picked = !existingChip;

    if (existingChip) {
      existingChip.remove();
      button.querySelector(":scope > [aria-hidden]")?.remove();
    } else {
      const chip = chipTemplate!.content.cloneNode(true) as DocumentFragment;
      const chipButton = chip.querySelector("button")!;
      chipButton.setAttribute("aria-label", `Remove ${skill}`);
      chipButton.prepend(skill);
      chosenList!.append(chip);
      button.append(checkTemplate!.content.cloneNode(true));
    }
    button.setAttribute("aria-pressed", String(picked));
    swapClasses(button, picked, SKILL_PICKED, SKILL_IDLE);
  }

  for (const card of skillCards) {
    card
      .querySelector("button")
      ?.addEventListener("click", () => toggleSkill(card.dataset.skill!));
  }
  chosenList.addEventListener("click", (event) => {
    const chip = (event.target as Element).closest("li");
    if (chip) toggleSkill(chipLabel(chip));
  });

  // --- Backspace in the empty field removes the last chip (skills first, then titles) -----
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Backspace" || input.value !== "") return;
    const lastSkill = chosenList.lastElementChild;
    if (lastSkill) toggleSkill(chipLabel(lastSkill));
    else titleList.lastElementChild?.remove();
  });

  // --- Group tabs filter the skills grid --------------------------------------------------
  function selectGroup(selected: HTMLElement): void {
    const group = selected.textContent?.trim() ?? ALL_GROUPS;
    for (const tab of tabs) {
      const isSelected = tab === selected;
      tab.setAttribute("aria-selected", String(isSelected));
      tab.tabIndex = isSelected ? 0 : -1;
      swapClasses(tab, isSelected, TAB_SELECTED, TAB_IDLE);
    }
    for (const card of skillCards) {
      card.hidden = group !== ALL_GROUPS && card.dataset.group !== group;
    }
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => selectGroup(tab));
    // Left / right arrows move to the neighbouring tab, wrapping around.
    tab.addEventListener("keydown", (event) => {
      const step =
        event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
      if (step === 0) return;
      event.preventDefault();
      const next = tabs[(index + step + tabs.length) % tabs.length];
      selectGroup(next);
      next.focus();
    });
  });

  // --- Submit: build one sentence from the chips and the typed text -----------------------
  function buildPrompt(): string {
    const typed = input!.value.trim();
    const chosenTitles = titles();
    const chosenSkills = pickedSkills();
    if (chosenTitles.length === 0 && chosenSkills.length === 0) return typed;

    const who =
      chosenTitles.length > 0
        ? joinList(chosenTitles, "or")
        : capitalise(askedAs);
    const sentence =
      chosenSkills.length > 0
        ? `${who} with ${joinList(chosenSkills, "and")}.`
        : `${who}.`;
    return typed === "" ? sentence : `${sentence} ${typed}`;
  }

  // The site-wide prompt handler (src/scripts/site/prompts.ts) would send only the typed text.
  // It skips events that are already handled, so handle this one first: capture phase.
  document.addEventListener(
    "submit",
    (event) => {
      if (event.target !== form) return;
      event.preventDefault();
      // With nothing chosen and nothing typed, ask for the page's role itself.
      openBooking(buildPrompt() || capitalise(askedAs));
    },
    true,
  );
}

document
  .querySelectorAll<HTMLElement>("[data-role-builder]")
  .forEach(setUpBuilder);
