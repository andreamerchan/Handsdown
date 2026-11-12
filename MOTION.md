# Motion experiment — "Enfoque" (home page)

Branch: `experiment/motion-redesign`. Colours, type, copy and section order are unchanged.
The idea: things come into focus, the way a one-line request becomes a specific person on your team.
Each section uses that idea differently, and only where it explains something.

## How to view it

```bash
git checkout experiment/motion-redesign
npm install
npm run dev        # http://localhost:4321/
```

No npm available? `node tools/preview/build.mjs` renders a static preview of the home page
into `dist-preview/` (uses locally installed esbuild + tailwindcss; see the file header).

## Section by section

| Section | What moves | Why | Intensity |
|---|---|---|---|
| Hero | Headline lines come into focus one by one; when you leave, the globe recedes and fades | The promise lands first; the network steps back so the people (next section) take over | High |
| Talent | The grid's rules draw; each photo comes into focus (blurred twin fades out) | Calm moment: the people come into focus, text stays still and readable | Calm |
| Map story | Each reason's headline is set word by word (in from below, out through the top) | Five reasons read as a sequence of statements, not a slideshow | High |
| Two ways | A chip on each photo: one dot joins your row of people ("You lead the work.") vs. a pod with its own lead arrives ("We run delivery.") | Shows who runs the day-to-day, the actual difference between the two models | Medium |
| How we work, step 1 | Scroll-scrubbed sequence: the request is typed, key phrases light up and fly into the spec fields, each field focuses and is checked, then "Tested by" is added and a scan passes | Cause and effect: your words become a spec, plus the part we add (how it's tested) | High |
| Shortlist → team photo | The top candidate detaches from the shortlist, swings past the step bar and lands on the photo as "Edson, Senior Data Scientist"; the photo tour starts on landing | Closes the story: anonymous evidence becomes a person on your team | Medium |
| Commitments | One line runs through the three promises and lights each as it passes | "The whole engagement": from first message to after the start | Calm |
| Closing | Headline focuses, a ring sweeps the prompt once, suggestions rise | Invitation to act, pointed at the one input | Medium |

Removed: the generic fade-in (`data-reveal`) on Talent, Two ways, Commitments and Closing.

## Where things are

- `src/motion/tokens.ts` — every duration, easing, blur, stagger and scroll range (also exposed as `--m-*` CSS variables).
- `src/motion/core.ts` — shared frame loop, in-view helper, scroll progress, word splitting.
- `src/motion/home.ts` — wires each section.
- `src/motion/sections/spec-sequence.ts` — step 1 sequence (pure function of progress 0..1).
- `src/motion/sections/handoff.ts` — shortlist → photo flight.
- `src/styles/motion.css` — all motion styles; "before" states only under `html[data-motion="full"]`.

## Accessibility, mobile, performance

- `prefers-reduced-motion`: every section renders its finished state (spec complete, lines drawn, cards lit). Without JS, the same.
- Below 900px: no cross-section flight; step 1 plays on a timer when it scrolls into view; the rest is one-shot.
- Animations use opacity and transform (translate/scale). Blur is limited to one-time focus moments; photo blur is a pre-blurred twin whose opacity fades.
- No new dependencies. GSAP/Lenis were planned but could not be installed in the build environment; the runtime is ~7 KB minified (~3 KB gzip) of vanilla TS with one shared rAF loop.

## Tuning

Change values in `src/motion/tokens.ts`:
- `scroll.specSequenceShare` — how much of step 1's scroll range the sequence uses.
- `scroll.handoffLead` / `handoffLandAt` — when the shortlist card leaves and where it lands.
- `scroll.heroExitScale` / `heroExitFade` — how much the globe recedes.
- `durations.focus`, `blur.*`, `stagger.*` — feel of the focus pulls.

## Missing assets

- Optional video for the team photo ("joins your standup"): 6–8 s loop, no audio, MP4 (H.264) + WebM, 1920×1080 and a 1080×1350 crop for mobile, real people with consent. Until then the current photo + scorecard stays.
