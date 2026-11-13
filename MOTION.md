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
| Map story | Rebuilt as a lit 3D globe (see below); each reason's headline is set word by word | Five reasons read as one camera journey from the world to one person | High |
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

## Map story ("You bring the role…") — immersive globe

Replaces the flat Mercator dot map. Same five beats, same cards and copy; the
map is now a lit 3D globe drawn on canvas (`src/scripts/home-top/map-globe.ts`),
choreographed by `src/scripts/home-top/map-story.ts`.

| Beat | Camera | What it shows |
|---|---|---|
| Arrival | Globe rises over the horizon as the section scrolls in | Routes from companies worldwide (SF, NY, Austin, Toronto, London, Berlin, Madrid) arc into Latin American hubs |
| 1. You bring the role | Low horizon | Your company (square) and two talent hubs connect to the request card |
| 2. Working your hours | Whole globe, US in front | The Americas' time-zone band (UTC−8 to UTC−3) lights up; a route runs from the US to Latin America |
| 3. Only senior specialists | Into South America | Eight talent hubs light up one by one and join into one network |
| 4. Vetted against your role | Close on São Paulo | Rings and a target close in on one place while the checks complete |
| 5. We stay after they start | Pull back | São Paulo ↔ US route; day 30 / 60 / 90 check-ins light up along it; a light keeps travelling |

Depth: Lambert-lit land dots with limb darkening, atmosphere halo and rim,
routes lifted above the surface (visible past the horizon), space dust on
several shells (parallax), brand-coloured light blooms and film grain (CSS,
`src/styles/map-story.css`). Brand indigo/violet replaces the reference's green.

Fallbacks: reduced motion follows the scroll exactly with no idle motion;
devices reporting ≤4 cores/≤4 GB memory or Save-Data, or frames running slow
for ~40 frames, switch to a lite render (half the dots, 1× pixels, no dust or
mesh). Rendering pauses off-screen and in background tabs. Camera keyframes
are in `DESKTOP_KEYS` / `PHONE_KEYS` in map-story.ts.
