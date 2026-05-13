<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# UI must match hiveny.com

All UI work in this portal must visually align with the public Hive marketing site at https://hiveny.com. The portal is internal, but it shares brand. Use these tokens (defined in `src/app/globals.css` via Tailwind v4's `@theme`):

**Colors (exact, from hiveny.com source):**
- `--color-ink: #1a1a18` — primary text, dark surfaces
- `--color-accent: #d4920b` — honey gold, primary accent / CTAs
- `--color-accent-dark: #b87d09` — accent hover state
- `--color-accent-text: #9a6f08` — accent text on light backgrounds (links)
- `--color-cream: #f5f2ed` — warm off-white background
- `--color-warm: #e8e3db` — warm beige (subtle panels)
- `--color-stone: #c4bdb3` — borders / dividers
- `--color-muted: #8a8378` — muted text
- `--color-white: #fefdfb` — warm white

**Fonts (Google Fonts, loaded in `app/layout.tsx`):**
- Sans (body/UI): **DM Sans** — weights 300, 400, 500, 600
- Serif (display/italic accent): **Cormorant Garamond** — italic 300/400 for emphasis words

**Type usage:**
- Body and form text: DM Sans 400.
- Headings: DM Sans 500–600.
- Italicized accent words within headings (e.g. *"Redefined"*, *"Vacancy"*): Cormorant Garamond italic.

**Spatial rhythm:**
- Generous vertical spacing between sections (py-16 / py-20 desktop).
- Max-content width ~1200px (`max-w-6xl`).
- Cards: warm white background, soft shadow, no hard borders; rounded-xl.
- Buttons: rounded-full or rounded-lg, solid honey for primary, ink outline for secondary.

When designing a new screen, prefer the cream background with white card surfaces and honey accents over generic Tailwind grays.
