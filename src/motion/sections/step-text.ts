/**
 * "How we work": the text of each step moves with the scroll (Apple-style),
 * instead of switching at once.
 *
 * Purpose: the scroll is the timeline. Each line of a step (eyebrow, each
 * line of the headline, the paragraph, the button) rises into focus in turn
 * as the step arrives, holds while it is read, then lifts away just before
 * the next step's lines come in. Scrolling back plays it in reverse.
 *
 * Everything is a pure function of the scroll position, so it is smooth at
 * any speed and correct when revisiting. Animated properties: opacity,
 * translate, and a short blur only while a line is in motion.
 */

import { clamp, onFrame, smoothstep } from "../core";
import { tokens } from "../tokens";

const { stepText } = tokens.scroll;

interface Line {
  el: HTMLElement;
  /** Stagger of this line, in step units. */
  delay: number;
}

export interface StepText {
  /** Pinned layout: `progress` is the stage's scroll progress, unclamped (negative before it pins). */
  renderPinned(progress: number, stepSpan: number): void;
  /** Stacked layout: lines follow each step's own position on screen. Returns a stop function. */
  startFlow(): () => void;
  clear(): void;
}

export function createStepText(steps: HTMLElement[]): StepText {
  const columns = steps.map((step) => step.querySelector<HTMLElement>(".www-hww-text"));
  const lines: Line[][] = columns.map((column) => {
    if (!column) return [];
    const els: HTMLElement[] = [];
    for (const child of [...column.children] as HTMLElement[]) {
      // The headline is animated line by line.
      if (child.tagName === "H3") els.push(...([...child.children] as HTMLElement[]));
      else els.push(child);
    }
    return els.map((el, i) => ({ el, delay: i * stepText.stagger }));
  });

  const apply = (line: Line, enter: number, exit: number) => {
    const opacity = enter * (1 - exit);
    const y = (1 - enter) * stepText.rise - exit * stepText.lift;
    const blur = (1 - enter) * stepText.blur + exit * stepText.blur * 0.6;
    const s = line.el.style;
    s.opacity = opacity.toFixed(3);
    s.translate = `0 ${y.toFixed(1)}px`;
    s.filter = blur > 0.15 ? `blur(${blur.toFixed(2)}px)` : "";
    s.pointerEvents = opacity < 0.6 ? "none" : "";
  };

  /** Lines of step `index` at local position `u` (0 = step starts, 1 = next step starts). */
  const renderStep = (index: number, u: number, isLast: boolean) => {
    const [enterFrom, enterTo] = index === 0 ? stepText.firstEnter : stepText.enter;
    for (const line of lines[index]) {
      const enter = smoothstep(enterFrom + line.delay, enterTo + line.delay, u);
      const exit = isLast ? 0 : smoothstep(stepText.exit[0] + line.delay * 0.5, stepText.exit[1] + line.delay * 0.5, u);
      apply(line, enter, exit);
    }
  };

  return {
    renderPinned(progress, stepSpan) {
      steps.forEach((_, index) => {
        const u = (progress - index * stepSpan) / stepSpan;
        renderStep(index, u, index === steps.length - 1);
      });
    },
    startFlow() {
      return onFrame(() => {
        const vh = innerHeight;
        columns.forEach((column, index) => {
          if (!column) return;
          // 0 when the column's top is just below the fold, 1 when it reaches 58% of the screen.
          const f = clamp((0.98 - column.getBoundingClientRect().top / vh) / 0.4);
          for (const line of lines[index]) {
            const start = line.delay * 1.5;
            apply(line, smoothstep(start, start + 0.45, f), 0);
          }
        });
      });
    },
    clear() {
      for (const line of lines.flat()) {
        const s = line.el.style;
        s.opacity = s.translate = s.filter = s.pointerEvents = "";
      }
    },
  };
}
