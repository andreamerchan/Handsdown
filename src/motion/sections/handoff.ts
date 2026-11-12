/**
 * Shortlist -> team photo hand-off (wide screens only).
 *
 * Purpose: close the story. The top candidate of step 4 ("Candidate A,
 * scored against your role") detaches from the shortlist as the visitor
 * scrolls on, and lands on the team photo as a named person ("Edson,
 * Senior Data Scientist"). Anonymous evidence becomes someone on your team.
 *
 * The flying card is a fixed, decorative clone (aria-hidden). Its path is a
 * pure function of where the shortlist row and the photo's card are on
 * screen, so it reverses cleanly when scrolling back up. When it lands, the
 * real card takes over and the team-photo tour starts (see team-photo.ts).
 */

import { canFly, easeInOut, lerp, onFrame, range, smoothstep } from "../core";
import { tokens } from "../tokens";

/** Pixels the card swings right while it descends, to clear the step bar. */
const SWING = 130;

export function setUpHandoff() {
  const team = document.querySelector<HTMLElement>(".www-team");
  const target = team?.querySelector<HTMLElement>(".www-team-card");
  const source = document.querySelector<HTMLElement>(".www-hww-cv[data-top]");
  if (!team || !target || !source) return;

  const ghost = document.createElement("div");
  ghost.className = "hd-handoff";
  ghost.setAttribute("aria-hidden", "true");
  ghost.innerHTML = `
    <div class="hd-handoff-a">
      <span class="hd-handoff-avatar">E</span>
      <span><b>Candidate A</b><small>Scored against your role</small></span>
    </div>
    <div class="hd-handoff-b">
      <b>Edson</b><small>Senior Data Scientist</small>
    </div>`;
  document.body.append(ghost);

  let state: "pending" | "landed" | "" = "";
  const setState = (next: "pending" | "landed") => {
    if (next === state) return;
    state = next;
    team.dataset.handoff = next;
    team.dispatchEvent(new CustomEvent("hd:handoff", { detail: { landed: next === "landed" } }));
  };

  const update = () => {
    if (!canFly()) {
      ghost.style.opacity = "0";
      if (state) {
        state = "";
        delete team.dataset.handoff;
      }
      return;
    }
    const vh = innerHeight;
    const to = target.getBoundingClientRect();
    const t = range(vh * (1 + tokens.scroll.handoffLead), vh * tokens.scroll.handoffLandAt, to.top);
    setState(t >= 1 ? "landed" : "pending");
    if (t <= 0 || t >= 1) {
      ghost.style.opacity = "0";
      return;
    }

    let from: { left: number; top: number; width: number; height: number } = source.getBoundingClientRect();
    // If the shortlist is not on screen (e.g. a fast scroll), rise from below the card.
    if (!from.width || source.closest(".www-hwws-step:not([data-shown])") && document.querySelector(".www-hwws[data-layout='pinned']")) {
      from = { left: to.left, top: to.top + 160, width: to.width, height: 64 };
    }
    // Vertical travel follows the scroll; the sideways move waits until the card
    // is over the photo, so it never crosses the step bar or other text.
    const e = easeInOut(t);
    const swing = Math.sin(Math.PI * Math.min(1, t / 0.75)) * SWING;
    const left = lerp(from.left, to.left, easeInOut(smoothstep(0.45, 1, t))) + swing;
    const top = lerp(from.top, to.top, e);
    ghost.style.translate = `${left.toFixed(1)}px ${top.toFixed(1)}px`;
    ghost.style.width = `${lerp(from.width, to.width, e).toFixed(1)}px`;
    ghost.style.height = `${lerp(from.height, to.height, e).toFixed(1)}px`;
    ghost.style.setProperty("--swap", String(smoothstep(0.55, 0.75, t)));
    ghost.style.opacity = String(Math.min(range(0, 0.05, t), 1 - range(0.93, 1, t)));
  };

  onFrame(update);
}
