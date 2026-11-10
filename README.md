# Handsdown

Marketing site for Handsdown, a staff augmentation company: senior engineers, designers, data and
product specialists from Latin America.

Static site built with [Astro](https://astro.build) and [Tailwind CSS v4](https://tailwindcss.com).
No framework runtime: pages are HTML, and behaviour is small TypeScript files.

## Run it

Requires Node 22 or newer.

```bash
npm install
```

```bash
npm run dev
```

Opens at http://localhost:4321 and reloads as you edit.

```bash
npm run build
```

Writes the finished site to `dist/`. Any static host can serve that folder (Vercel, Netlify,
Cloudflare Pages, S3). On Vercel and Netlify, importing the repo is enough: both detect Astro.

Before going live, set `site` in `astro.config.mjs` to the real domain. It is used for canonical
links and search-engine metadata.

## Where things are

```
src/
  pages/        One file per URL. hire/[category]/ builds a page per JSON file (see below).
  layouts/      Base.astro (<head>, fonts, metadata) and Site.astro (header + footer around a page).
  components/   Sections, grouped by page: home/, how-it-works/, pricing/, hire/, site/ (header, footer, logo).
  data/         Content that is not page-specific markup (see below).
  scripts/      Behaviour, grouped the same way as components.
  styles/       theme.css (design tokens), utilities.css, components.css, extras.css (keyframes).
public/
  brand/        Photos and data files used by the animations.
  fonts/        Plus Jakarta Sans.
```

## Editing content

**Text on a page.** Open the section's component in `src/components/<page>/` and edit the text.
`src/pages/<page>.astro` lists the sections in order.

**Roles and categories** (`/hire/...`). These pages come from data, not from markup:

- `src/data/roles/<category>/<role>.json` is one role page, at `/hire/<category>/<role>`.
  Copy an existing file to add a role.
- `src/data/categories/<category>.json` is one category page, at `/hire/<category>`.
  Its `specializations.roles` list is the cards shown on that page.
- The templates that turn this data into pages are in `src/components/hire/`.

**Navigation.** `src/data/site.ts` holds the header links, the "Hire Talent" menu (with the
specialist counts shown next to each group) and the footer columns.

**Pricing.** The numbers behind the estimator on `/pricing` are in `src/data/pricing.ts`.

## Styling

Markup uses Tailwind utility classes. The design tokens (colours, spacing, radii, shadows,
easing) are in `src/styles/theme.css`; changing a token there changes it everywhere, and every
token is available as a utility (`--color-text-primary` gives `text-text-primary`,
`bg-text-primary`, and so on).

Larger hand-written pieces, mostly the scroll animations, are the `.www-*` classes in
`src/styles/components.css`. Scripts drive them by setting `data-*` attributes and CSS variables.

## What still needs a backend

The site is static. Three things are stubbed and say so on screen instead of pretending to work:

| Feature | Now | To connect |
| --- | --- | --- |
| "Describe your role" prompts and the header button | Go to `/book` with the text prefilled | Change `promptDestination` in `src/data/site.ts` |
| Request form on `/book` | Validates, then reports it is not connected | Set `bookFormEndpoint` in `src/data/site.ts` to a URL that accepts a form POST |
| "Start application" on `/apply` | Reports it is not connected | Set `applyDestination` in `src/data/site.ts` |

Analytics are not included.
