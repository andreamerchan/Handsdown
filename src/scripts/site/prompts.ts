// "Describe your role" prompts (hero inputs, closing sections).
//  - Submitting sends the visitor to the request form with their text carried over.
//  - Suggestion chips listed under a prompt fill its input.
import { promptDestination } from "../../data/site";

const isPrompt = (form: HTMLFormElement) =>
  !form.hasAttribute("action") &&
  form.querySelectorAll('input[type="text"]').length === 1;

/** The chip list that belongs to a prompt: a <ul> of buttons right after the form's wrapper. */
function chipsFor(form: HTMLFormElement): HTMLButtonElement[] {
  let node: HTMLElement | null = form;
  for (let level = 0; node && level < 3; level++, node = node.parentElement) {
    const next = node.nextElementSibling;
    const list = next?.matches("ul")
      ? next
      : next?.querySelector(":scope > ul");
    if (!list) continue;
    const items = [...list.children];
    const buttons = items.map((li) =>
      li.querySelector<HTMLButtonElement>(':scope > button[type="button"]'),
    );
    if (items.length > 0 && buttons.every(Boolean))
      return buttons as HTMLButtonElement[];
  }
  return [];
}

for (const form of document.querySelectorAll("form")) {
  if (!isPrompt(form)) continue;
  const input = form.querySelector<HTMLInputElement>('input[type="text"]')!;

  form.addEventListener("submit", (event) => {
    if (event.defaultPrevented) return;
    event.preventDefault();
    const text = input.value.trim();
    location.href = text
      ? `${promptDestination}?role=${encodeURIComponent(text)}`
      : promptDestination;
  });

  for (const chip of chipsFor(form)) {
    chip.addEventListener("click", () => {
      input.value = chip.textContent?.trim() ?? "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus();
    });
  }
}
