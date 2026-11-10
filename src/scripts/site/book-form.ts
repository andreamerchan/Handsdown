// The /book request form.
//  - Text typed into a "Describe your role" prompt arrives as ?role=... and prefills the form.
//  - Submits in the background to bookFormEndpoint (src/data/site.ts) and reports the result.
import { bookFormEndpoint } from "../../data/site";

const form = document.querySelector<HTMLFormElement>("[data-book-form]");
if (form) {
  const need = form.querySelector<HTMLTextAreaElement>('textarea[name="need"]');
  const email = form.querySelector<HTMLInputElement>('input[name="email"]');
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const status = form.querySelector<HTMLElement>("[data-form-status]");

  const role = new URLSearchParams(location.search).get("role");
  if (role && need && !need.value) need.value = role;

  const say = (message: string) => {
    if (!status) return;
    status.textContent = message;
    status.hidden = false;
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const validEmail =
      !!email && email.value.trim() !== "" && email.checkValidity();
    email?.setAttribute("aria-invalid", String(!validEmail));
    if (!validEmail) {
      say("Enter your work email so we can reply.");
      email?.focus();
      return;
    }
    // Hidden "website" field: only bots fill it in.
    if (new FormData(form).get("website")) return;

    if (!bookFormEndpoint) {
      say(
        "This form is not connected yet (set bookFormEndpoint in src/data/site.ts).",
      );
      return;
    }

    if (submit) submit.disabled = true;
    say("Sending…");
    try {
      const response = await fetch(bookFormEndpoint, {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(String(response.status));
      form.reset();
      say("Thanks. A talent partner will reply by email.");
    } catch {
      say(
        "Something went wrong and the request was not sent. Please try again.",
      );
    } finally {
      if (submit) submit.disabled = false;
    }
  });
}
