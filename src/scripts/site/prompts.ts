// "Describe your role" prompts (hero inputs, closing sections).
//  - Submitting sends the visitor to the request form with their text carried over.
//  - Suggestion chips listed under a prompt fill its input.
import { hireMenu, promptDestination } from "../../data/site";

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

// ---------------------------------------------------------------- role suggestions
// Prompts marked role="combobox" suggest matching role names while the visitor types.
// Arrow keys move through them, Enter or a click fills the input, Escape dismisses them.

const ROLE_NAMES = hireMenu.flatMap((group) =>
  group.roles.map((role) => role.name),
);
const MAX_SUGGESTIONS = 5;
const OPTION_BASE =
  "inline-flex min-h-11 items-center rounded-full border-[0.75px] px-4 text-sm transition-colors duration-120 ease-standard focus-visible:shadow-ring focus-visible:outline-none sm:min-h-0 sm:py-[7px]";
const OPTION_IDLE =
  "border-border-default bg-background-raised text-text-secondary hover:border-border-strong hover:text-text-primary";
const OPTION_ACTIVE =
  "border-border-strong bg-background-neutral text-text-primary";

/** Best matches first: name starts with the text, then a word starts with it, then contains it. */
function suggestRoles(text: string): string[] {
  const query = text.trim().toLowerCase();
  if (query.length < 2) return [];
  const score = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.startsWith(query)) return 0;
    if (lower.split(/[\s&/]+/u).some((word) => word.startsWith(query)))
      return 1;
    return lower.includes(query) ? 2 : -1;
  };
  return ROLE_NAMES.map((name) => ({ name, score: score(name) }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => a.score - b.score)
    .slice(0, MAX_SUGGESTIONS)
    .map((entry) => entry.name);
}

for (const input of document.querySelectorAll<HTMLInputElement>(
  'input[role="combobox"][aria-controls]',
)) {
  const list = document.getElementById(input.getAttribute("aria-controls")!);
  if (!list) continue;
  const status = input.form?.querySelector<HTMLElement>('[aria-live="polite"]');
  let suggestions: string[] = [];
  let active = -1;
  let dismissed = false;

  const render = () => {
    const open = suggestions.length > 0 && !dismissed;
    list.classList.toggle("hidden", !open);
    input.setAttribute("aria-expanded", String(open));
    list.replaceChildren(
      ...suggestions.map((name, index) => {
        const item = document.createElement("li");
        const option = document.createElement("button");
        option.type = "button";
        option.id = `${list.id}-option-${index}`;
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", String(index === active));
        option.className = `${OPTION_BASE} ${index === active ? OPTION_ACTIVE : OPTION_IDLE}`;
        option.textContent = name;
        // Keep focus in the input while clicking a suggestion.
        option.addEventListener("mousedown", (event) => event.preventDefault());
        option.addEventListener("click", () => choose(name));
        item.append(option);
        return item;
      }),
    );
    if (open && active >= 0)
      input.setAttribute(
        "aria-activedescendant",
        `${list.id}-option-${active}`,
      );
    else input.removeAttribute("aria-activedescendant");
    if (status) {
      status.textContent = open
        ? `${suggestions.length} ${suggestions.length === 1 ? "role" : "roles"} suggested. Use the arrow keys to pick one.`
        : "";
    }
  };

  const choose = (name: string) => {
    input.value = name;
    suggestions = suggestRoles(name);
    dismissed = true;
    active = -1;
    render();
    input.focus();
  };

  input.addEventListener("input", () => {
    suggestions = suggestRoles(input.value);
    dismissed = false;
    active = -1;
    render();
  });

  input.addEventListener("keydown", (event) => {
    const open = suggestions.length > 0 && !dismissed;
    if (!open) return;
    if (event.key === "Escape") {
      dismissed = true;
    } else if (event.key === "ArrowDown") {
      active = (active + 1) % suggestions.length;
    } else if (event.key === "ArrowUp") {
      active = active <= 0 ? suggestions.length - 1 : active - 1;
    } else if (event.key === "Enter" && active >= 0) {
      event.preventDefault();
      choose(suggestions[active]);
      return;
    } else {
      return;
    }
    event.preventDefault();
    render();
  });
}
