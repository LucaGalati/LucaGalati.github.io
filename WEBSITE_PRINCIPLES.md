# Website architecture and principles

Playbook for structural maintenance of lucagalati.com, written for whoever (human or AI agent) touches templates, configuration or tooling. Day-to-day content edits are covered by `UPDATING.md`. The site was built to Gary King's academic-site spec (`ACADEMIC_SITE_PROMPT.md`, gking.harvard.edu/mysite); decisions that are hard to reverse are recorded in `docs/adr/`, the vocabulary in `CONTEXT.md`, the interview that produced the brief in `docs/brief.md`.

## Stack

| Layer | Choice |
|---|---|
| Generator | Hugo 0.164.0 extended (`HUGO_VERSION` in `deploy.yml`; Blox requires ≥ 0.148.2) |
| Theme | Hugo Blox `blox-tailwind` v0.10.0 + `blox-analytics` v0.2.0, Go modules vendored in `_vendor/` |
| CSS | Tailwind v4 through the theme (npm `@tailwindcss/cli`), plus `assets/css/custom.css` for everything this site looks like |
| Search | Pagefind (npm, WASM index built from `public/` after Hugo) |
| Hosting | GitHub Pages user site, repo `LucaGalati/LucaGalati.github.io`, served at the domain root |
| CI | `.github/workflows/deploy.yml`: Node 24 + `npm ci`, Hugo `.deb`, `hugo --gc --minify`, `npx pagefind --site public`, `actions/deploy-pages` |

The repository root is the Hugo root. `baseURL` is fixed in `hugo.yaml` and deliberately not derived from the Pages CI variable (which can resolve to `http://` and poison canonical URLs and the sitemap).

## Toolchain gotchas

- Hugo's `css.TailwindCSS` requires the npm `@tailwindcss/cli` package; the standalone Tailwind binary is rejected. CI must run `setup-node` + `npm ci` before `hugo`. Keep Node at 22 or newer (CI uses 24; local development has been done on 26).
- `build.buildStats.enable: true` emits `hugo_stats.json` so Tailwind sees the classes used in templates; the file is gitignored and regenerated on every build.
- `_vendor/` is committed, so CI needs no Go toolchain. `go.mod` and `go.sum` are committed alongside; `_vendor/modules.txt` pins the module versions.
- Blox uses `layouts/_partials/`, never `layouts/partials/`. A partial placed under the old path is silently ignored.
- Hooks: `layouts/_partials/hooks/<name>/*.html` are included by Blox's `functions/get_hook` in file-name order. Dropping a file into `hooks/head-end/` adds to `<head>`; `hooks/body-end/` runs before `</body>`. Nothing needs registering.
- Blox's `site_head` auto-loads `assets/css/custom.css` after the Tailwind bundle. Tailwind v4 puts its utilities in `@layer`, so plain unlayered rules in `custom.css` win the cascade without `!important`.
- The build prints four deprecation `WARN`s from the theme (`languageCode`, `module.mounts.includeFiles`, `.Site.Data`, `.Site.LanguageCode`). Expected; not from this repo.
- `disableKinds: ["taxonomy", "term"]`: `tags` and `publication_types` are declared only because the theme expects them; the Research page filters client-side, and term pages would only add noise to the sitemap and the search index. `content/tags/`, `content/publication_types/` and `layouts/taxonomy.html` are inert while that setting holds.
- The theme still declares its own Inter `@font-face` (`/dist/font/Inter.var.woff2`, a local file with a leading slash). No rule uses the family, so nothing is fetched; it is the one leading-slash URL in the output and it comes from the vendored theme, not from this repo.

## Layout override strategy

Keep Blox's `site_head` (Tailwind compile, SEO, favicon from `assets/media/icon.png`, custom.css) and override only what the site controls. Every file in `layouts/`:

| File | Role |
|---|---|
| `baseof.html` | Shell (overrides Blox): `site_head`, skip link, navbar partial, `<main data-pagefind-body>`, footer, `body-end` hook. |
| `index.html` | Homepage: hero (text, 3:4 portrait from `assets/images/luca-galati-portrait.jpg`, profile icons, two outline buttons), the research-area map (`figure#research-net`, see below) and the `#research-areas` accordions from `data/research_areas.json` via `pub_row.html`. Do not set `type: landing` on `content/_index.md`. |
| `404.html` | Not-found page with Search, Home and Research buttons (overrides Blox). |
| `robots.txt` | Allow all; `Sitemap:` and a pointer to `llms.txt`, both `absURL` (overrides Blox). |
| `taxonomy.html` | Taxonomy index rows; inert while taxonomies are disabled (overrides Blox). |
| `_default/list.html`, `_default/single.html` | Generic section and page: breadcrumbs, title, `.prose`; the list shows child pages with `summary`. Would serve `content/resources/` once published. |
| `bio/list.html` | Bio & CV: Download CV button, 3:4 portrait (`.bio__photo`, 240×320, monogram fallback), Markdown body, `data/cv.json` sections, "Other presentations" from `data/other_presentations.json` (between Service and Peer review), contact block. |
| `publication/list.html` | Research page: server-rendered rows in `weight` order, each one the title, then "with" the co-authors (the owner is left out: `authors.html` with `without_owner`), then the venue and year (venue in `<b class="pub-item__venue">`, "Letter" badge, "Full text" for theses, "Presentation" from `url_presentation`), `.pub-group` headings between the article rows, four tabs, filters, inline JS, BibTeX export; "Explore" mini button under the explorable guard. |
| `publication/single.html` | Paper page: breadcrumb, title, JMP badge, authors, venue (journal in `<b>`; for a thesis `degree, institution` in `<b>`; "Letter" badge), ranking, link buttons (Explore first when the explorable exists, then "Presentation" from `url_presentation`, "Full text" from `url_full`), Cite toggle, abstract (`id="abstract"`, absent when empty), "Presented at" from `events:`, "Awards" from `award:`, See also. |
| `teaching/list.html` | Intro from the page body, courses from `data/teaching.json` (accepts an array or `{intro, courses}`). |
| `shortcodes/staticrel.html` | `{{< staticrel "files/x.pdf" >}}` renders a `relURL`. |
| `_partials/authors.html` | Citation author list; owner marked with `.author--owner`, co-authors linked via `data/coauthors.json`. With `without_owner: true` it lists the co-authors only (the "with …" line of the list rows) and yields nothing for a single-authored paper. |
| `_partials/award_badge.html`, `_partials/jmp_badge.html` | The `.badge-award` and `.badge-jmp` spans. |
| `_partials/bibtex_entry.html` | `@article` or `@unpublished`; for `publication_types: ["thesis"]` `@phdthesis` (degree "PhD…"/"Doctoral…"), `@mastersthesis` ("Master…") or `@misc` with `note = {<degree>}`, `school` = `institution`, `url` = `url_full`; key `<lastname><year><first title word>`; `&` escaped. |
| `_partials/breadcrumbs.html` | Home / Section / Page; section labels from `i18n` keys `section_<name>`. |
| `_partials/events.html` | `<ul class="events">` of `<li class="event">` from a list of `{name, organizer, city, country, online, url}`: "Name, Organizer, City, Country", `online: true` replaces city and country with "online", empty parts skipped; with a `url` the name is a link to the talk's own page (new tab). Shared by the paper page and the Bio "Other presentations". |
| `_partials/pub_row.html` | Compact paper row for the homepage accordions, same order as the Research rows: title, "with" the co-authors, venue and year (venue in `<b>`, "Letter" badge, "Full text" from `url_full`, Explore mini button under the explorable guard). |
| `_partials/related_finder.html` | The "See also" algorithm (below); labels `[Paper]`, `[Working paper]`, `[Thesis]`. |
| `_partials/site_footer.html` | Overrides Blox: hairline, site links, email, "Last updated" (`now.Format "January 2006"`), credit gated by `params.mysite.credit`. |
| `_partials/social-icon.html` | Inline SVG icons: email, scholar, orcid, ssrn, github, linkedin. |
| `_partials/components/headers/navbar.html` | Overrides Blox: brand, `site.Menus.main`, search button bound to Blox's `[data-search-toggle]`, mobile toggle, active state by URL prefix. |
| `_partials/components/search-modal.html` | Overrides Blox's Alpine modal: Pagefind imported with `relURL` and only on first open; Google `site:` fallback when the bundle fails. |
| `_partials/hooks/head-end/analytics.html` | Cloudflare beacon only when `params.analytics.cloudflare_token` is non-empty. |
| `_partials/hooks/head-end/discovery.html` | `<meta name="generator">` and homepage Person JSON-LD, gated by `params.mysite.discovery`. |
| `_partials/hooks/head-end/fonts.html` | `@font-face` for Vollkorn and Geist, URLs via `relURL`, two `preload` links. |
| `_partials/hooks/head-end/scholarly.html` | `citation_*` meta and ScholarlyArticle JSON-LD on paper pages; theses get `citation_dissertation_institution` instead of `citation_journal_title` and a `Thesis` JSON-LD with `inSupportOf` = `degree`. |

UI strings live in `i18n/en.yaml`; templates call `i18n` with a `default` fallback, so a missing key never breaks the build.

## Content model

- Sections: `publication/` (papers), `bio/` (single `_index.md`), `teaching/` (`_index.md` + `data/teaching.json`), `resources/` (draft, out of the menu). No blog, no authors section, no Talks section: presentations are part of each paper.
- Papers are leaf bundles (`<slug>/index.md`); `permalinks` use `:contentbasename`, so the folder name is the URL and `title` is free to change.
- Paper front matter: `title`, `date`, `authors`, `publication_types` (`report` | `journal_article` | `thesis`), `publication`, `journal`, `volume`, `issue`, `pages`, `article_number`, `doi`, `status` (`published` | `in_preparation` | `forthcoming`), `tab` (`working-papers` | `articles` | `theses`), `group` (one research-area id: the heading the row sits under), `weight` (list position, 1 = top), `letter` (`true` for letters-journal papers: "Letter" badge), `areas`, `tags`, `jmp`, `award`, `ranking` (not rendered for the three top finance journals; the journal a working paper is aimed at is kept out of the public repository), `url_pdf` (`files/…`, no leading slash), `url_ssrn`, `url_code`, `url_slides`, `url_podcast`, `url_full` (theses: the "Full text" button), `degree` and `institution` (theses: venue line, BibTeX, Scholar), `abstract`, `events` (optional list of `{name, organizer, city, country, online, url}`, rendered under "Presented at"), `draft`. Optional overrides read by See also: `related_papers`, `see_also`. `tab` and `status` drive rendering; `publication_types` drives only the BibTeX type and the Scholar tags of theses. The raw `publication_types` label must never appear in output.
- `data/other_presentations.json`: array of `{title, authors, year, events}` for presentations of work that has no page; rendered on the Bio page only, with the same `events.html` partial.
- `data/research_areas.json`: `{"areas": [{"id", "name", "summary", "papers": [slug, …]}]}`, flat, in homepage order (market-design, fx-benchmarks, crypto, networks, accounting-esg). Feeds the accordions, the Research page area filter and the homepage map.
- `data/coauthors.json`: `{"Name": {"url", "type": "website|university|linkedin|unresolved", "affiliation"}}`; only `url` is read.
- `data/cv.json`: `header` (unused), `employment`, `appointments`, `education`, `honors`, `service`, `development` (unused), `peer_review`, `memberships`.
- `data/teaching.json`: array of `{title, institution, roles: [{role, term}], level, description, …}`; extra keys are ignored.
- Site-level facts (name, role, tagline, institution, email, address, profiles) are `params` in `hugo.yaml`; the menu is `menu.main`.

## Automatic "See also" (`related_finder.html`)

Runs at build time on every paper page over the publication section only; no data file, nothing to regenerate.

1. Explicit picks: `related_papers` (slugs) and `see_also` (`{url,title}` external, or `{section,slug}` with section `publication`).
2. Shared research area: slugs listed together in a `research_areas.json` area, or overlapping `areas:` front matter.
3. Scored backfill: +2 per shared title token (stop words and tokens shorter than 3 characters dropped), +1 per shared non-owner author, +2 per shared tag. Threshold 4, relaxed to 2 when fewer than 3 items came from steps 1–2.

Pinned items rank first, then area matches, then score, then year. Cap 8, dedupe by kind + normalised title, labels `[Paper]`, `[Working paper]` and `[Thesis]` (theses take part like any other page).

## Explorables (`static/explore/<slug>/index.html`)

An explorable explanation of a paper is a self-contained static page at `static/explore/<slug>/index.html`, `<slug>` being the paper's folder name; it is served at `/explore/<slug>/` as a plain static file, outside Hugo's page model (no front matter, no layout, no search index entry). The templates test for it with `fileExists (printf "static/explore/%s/index.html" $slug)` at build time: when the file exists the paper page renders `<a class="btn btn--explore">` first in `.paper__links`, and the Research rows and homepage rows render `<a class="mini-btn mini-btn--explore">`; when it does not, nothing is emitted. Links are `relURL` without a leading slash. The page itself must respect the privacy rule (no third-party requests) and should link back to the paper with a relative path.

An explorable is a folder of static files with its own CSS and JavaScript, so the site's navbar does not reach it. `static/explore/sitebar.js` supplies the way back: it defines the custom element `<lg-sitebar>` (shadow DOM, so no explorable's CSS can touch it), a 40px bar fixed to the top with "Luca Galati" (home), "Research" and "This paper", the paper's slug being read from the address. Every page loads it with a plain `<script src="../sitebar.js"></script>` in `<head>` and puts `<lg-sitebar></lg-sitebar>` first in `<body>`; the element is a 40px spacer in the flow and sets `--lg-sitebar-h` on `<html>`, which a page uses to offset whatever it pins to the top (headers, the map overlay, full-height stages). Children of the element are slotted at the right end of the bar, which is where an explorable can put its Map button. `plan.md` files (design notes, with remarks on the manuscripts) are kept out of the build by the static mount in `hugo.yaml` and out of the public repository by `.gitignore`.

`tools/explore-probe.mjs` is the check for this contract and for explorables in general: `node tools/explore-probe.mjs static/explore/<slug>` loads every page of the folder from disk in headless Chrome (DevTools protocol over Node's own WebSocket, no dependency) at 1280×800, 1440×900, 390×844 and 320×568, walks the slides with the right-arrow key, opens the map with `m`, and fails on a missing bar, anything under the bar, sideways overflow, a control cut off at the bottom, a console error or a request to another host. `--record` and `--baseline` compare the vertical overflow of each slide before and after a change.

## Research-area map (`index.html`, `figure#research-net`)

Hugo builds a JSON block (`<script type="application/json" id="net-data">`) from `data/research_areas.json` and the non-draft paper pages it lists: area nodes `{id, kind: "area", label, count}`, paper nodes `{id: slug, kind: "paper", label, short (title before the first colon), year, url, wp, jmp}`, and one link `{source: areaId, target: slug}` per area membership. An inline script (no library, no network) lays the graph out with a small force model, run for 300 iterations synchronously before the first paint, so nothing animates and `prefers-reduced-motion` needs no special case: all nodes repel (soft Coulomb), links pull with a spring of rest length 90, everything drifts gently to the centre, area hubs are pulled to anchors spread on an ellipse, and a repulsion point under each hub keeps papers off its label. Positions come from a seeded generator, so the picture is identical on every load. Which anchor an area takes is `map_order` in `data/research_areas.json` (ids clockwise from the top, passed to the script as `slot`; without it the list order is used): the accordion order is by importance, the map order by neighbourhood, so accounting sits apart at the bottom right and crypto next to networks.

It then draws into the `viewBox="0 0 1000 560"` SVG: `<line class="net__link">`, `<g class="net__area">` (circle r=26, label split over at most two lines, native `<title>`), `<a class="net__paper" href=…>` (circle r=7; r=9 and `net__paper--jmp` for job market papers; `net__paper--wp` for working papers; native `<title>`). Hovering or focusing a paper sets `is-hot` on its links and shows `.net__tip` (short title and year, `position: fixed` next to the pointer or the focused dot); hovering an area sets `is-hot` on its links and `is-dim` on the papers outside it. Paper nodes are real links and so keyboard-focusable; the SVG carries `role="img"` with a `<title>`, and the accordions below stay the complete, accessible list. Below 640px the figure scrolls sideways (`.net` overflow, `.net__svg` min-width 760px) so labels stay legible instead of shrinking to the screen width; the page itself never scrolls horizontally.

To tune: the constants at the top of the simulation loop (repulsion 9000 hub / 2200 paper, spring 0.05 and rest length 90, centering 0.003, anchor pull 0.1, ellipse radii 320×150, seed 11). Colours, stroke widths and the tooltip look belong to `custom.css` (`.net*` rules).

## Research page filtering

`publication/list.html` renders every non-draft paper as an `<article class="pub-item">` with `data-tab`, `data-group`, `data-year`, `data-slug`, `data-areas`, `data-title`, `data-authors`, `data-venue`, `data-abstract`, in `.ByWeight` order (front matter `weight`; the files follow working papers → articles by `group` in `research_areas.json` order → theses, newest first within each run; see `UPDATING.md`, "Order of the Research list"). Before the first article row of each `group` the template emits `<div class="pub-group" data-group="<id>"><h2>name</h2></div>`, the name looked up in `data/research_areas.json` (id as fallback); working papers and theses get no heading. The inline script filters those rows in place (no fetch, no framework): four `.tab-btn` with `data-tab` = `all | working-papers | articles | theses`, hash routing (`#working-papers` on load and on click, `pushState`), text search over title/authors/venue/abstract/year, area select matching `data-areas`, year checkboxes, sort (newest = the server order restored, headings included; oldest, A–Z, Z–A flat), Reset, result count with `aria-live` (rows only), and "Download citations", which concatenates the BibTeX of the visible rows (embedded as JSON in `#pub-data`) into `luca-galati-citations.bib`. A heading is shown only while the sort is "Newest first" and at least one article row of its group passes the current tab, search and filters. Each row links to the paper page; every row carries the badges and mini buttons the paper page shows.

## Sub-path safety

The site lives at the domain root, but keep sub-path discipline: never write a literal leading `/` for a site path in templates, CSS or front matter. Templates use `relURL` on paths without a leading slash (`{{ "fonts/x.woff2" | relURL }}`); Markdown uses the `staticrel` shortcode; front matter uses `url_pdf: files/…`. The Pagefind import in the search modal is `relURL`-wrapped. Menu entries in `hugo.yaml` (`/bio/` etc.) are resolved by `relLangURL` in the navbar and footer, which is safe. Absolute URLs (`absURL`) are used only where the consumer needs them: `citation_pdf_url`, JSON-LD, robots.txt.

## Design system

Everything visual is in `assets/css/custom.css`, which starts with the tokens, each defined on `:root` (light) and redefined under both `@media (prefers-color-scheme: dark)` and `html.dark, [data-theme="dark"]`:

| Token | Light | Dark |
|---|---|---|
| `--color-bg` | `#FCFBF8` | `#0B1A2E` |
| `--color-surface` | `#F3F0E8` | `#13263F` |
| `--color-text` | `#1C1C1A` | `#E8EDF3` |
| `--color-text-muted` | `#5A5A56` | `#A7B3C2` |
| `--color-accent` (= `--color-link`, `--color-institution`) | `#003262` | `#8EC1E6` |
| `--color-link-hover` | `#1B2A4A` | `#B5D7F2` |
| `--color-gold` | `#FDB515` | `#FDB515` |
| `--color-on-gold` | `#003262` | `#0B1A2E` |
| `--color-border` / `--color-border-strong` | `#D9D6CE` / `#C7C3B9` | `#23395A` / `#2E4768` |

Plus `--font-serif` (`"Vollkorn", Georgia, "Times New Roman", serif`), `--font-sans` (`"Geist", system-ui, …`), `--font-mono`, `--radius: 3px`, `--nav-h: 56px`, `--tabs-h: 48px`, `--gutter`. Blox's `--color-primary-50…950` scale is remapped onto the tokens so no Tailwind blue survives.

- Type: Vollkorn (variable 400–900, italic) for the name, h1–h3, paper titles and running text (abstracts, bio, course descriptions, 17px/1.6); Geist (variable 100–900, italic) for navigation, metadata, buttons, badges, tabs, filters, data rows, CV rows and the footer. Self-hosted woff2 in `static/fonts/` (latin and latin-ext subsets, `font-display: swap`), declared in `hooks/head-end/fonts.html` with `relURL`; only the stacks live in the CSS.
- Register ("serious"): weights 400–500 for display; journal names are the one bold element in a citation (`<b>` in rows and on the paper page); name 44–50px; h2 24px; nav 12.5px uppercase, letter-spacing 0.11em, weight 500; metadata 14–14.5px muted; running text fills the content column; content width 1100px; hairline rules instead of cards; no shadows; radius 3px; `prefers-reduced-motion` respected.
- Gold: used sparingly as a mark, never as a surface and never as running text on the light background. Where it appears: the owner's name in author lists (`.author--owner`), the JMP badge outline, the active tab underline, and small accents such as the Explore button, the map's highlighted nodes and a few rules. Each gold rule in `custom.css` sits in its own commented block so a touch can be added or removed in one place.
- Portrait: `assets/images/luca-galati-portrait.jpg`, 660×880 (3:4), rendered at 160×213 in the hero (`.Fill "480x640 Center q85"`, `.hero__photo`, width in `--hero-photo`) and at 240×320 on the Bio page (`.Fill "660x880 Center q85"`, `.bio__photo`); both sizes are set in CSS, not in a scoped style. The monogram span is the fallback when the file is missing.
- Dark mode follows the visitor's system (`appearance.mode: system`); Blox's theme toggle is hidden by CSS. Gold stays the same in both schemes; the accent flips to the light blue.
- Class names are the contract between templates and CSS (`.wrap`, `.site-nav__*`, `.hero__*`, `.btn--outline`, `.btn--explore`, `.mini-btn`, `.mini-btn--explore`, `.area*`, `.pub-*`, `.paper__*` incl. `.paper__events`, `.paper__awards`, `.events`/`.event`/`.event__name`, `.presentation*`, `.net*` (`.net__svg`, `.net__tip`, `.net__link`, `.net__area`, `.net__paper`, `--jmp`, `--wp`, state classes `is-hot` on links and `is-dim` on papers), `.see-also`, `.course*`, `.cv-*`, `.contact`, `.site-footer*`, `.breadcrumbs`, `.prose`). Rename on both sides or not at all.

## Privacy constraints (ADR 0003)

The site is served from Germany to a European audience. The rendered pages make no request to any third party: fonts are self-hosted, there is no Google Fonts link, no Google Analytics, no cookies, no consent banner. The only optional external script is the Cloudflare Web Analytics beacon, emitted by `hooks/head-end/analytics.html` only when `params.analytics.cloudflare_token` is set. Do not "fix" a missing font by adding a `fonts.googleapis.com` link, and do not add any tag manager, embed or CDN script; if a feature needs one, it needs a decision first.

## Deliberate deviations from the King spec

- Dark mode is automatic (the spec forces light); the toggle is hidden.
- No People page: the owner is a solo researcher; co-author links live in the citations via `data/coauthors.json`.
- "Research" instead of "Writings", at `/publication/`.
- No Software section and no Talks section: presentations sit on each paper page (`events:` front matter) and, for work without a page, on the Bio page (`data/other_presentations.json`).
- Repo root is the Hugo root (no `hugo-site/` subfolder); GitHub Pages user site, not a project site, with sub-path discipline kept anyway.
- Taxonomy term pages disabled; filters are client-side.
- Fonts self-hosted and Cloudflare Web Analytics instead of Google Fonts and Google Analytics (ADR 0003).
- `baseURL` fixed in `hugo.yaml`, not taken from CI.

## How the content was produced

One-off migration on 2 November 2026 from the owner's LaTeX CV, the Google Sites pages (bio, course descriptions, abstracts), Crossref and OpenAlex (bibliographic data, dates) and SSRN (preprint links). The `# generated-by: gen_content.py` comment in the front matter is a trace of that run; the script is deliberately not kept in the repo. The Markdown front matter and the `data/*.json` files are now the single source of truth: edit them directly, never regenerate. Open questions from the migration are listed under "Known items to review" in `UPDATING.md`.

## Local preview

```bash
npm install
hugo server                 # http://localhost:1313/ (-D to include drafts); search unavailable here
hugo --gc --minify && npx pagefind --site public && (cd public && python3 -m http.server 8787)
```

## Verification checklist after structural changes

Run from the repo root after `hugo --gc --minify` (the output is minified, hence the optional quotes in the patterns):

```bash
hugo --gc --minify                                   # must exit 0; only the four theme WARNs above
grep -rlE 'googleapis|gtag|cloudflareinsights' public/   # empty, unless cloudflare_token is set
for f in public/publication/*/index.html; do grep -q citation_title "$f" && grep -q 'application/ld+json' "$f" || echo "MISSING: $f"; done
grep -oE 'class="?tab-btn' public/publication/index.html | wc -l                  # 4
grep -oE '<article class="?pub-item' public/publication/index.html | wc -l         # = number of visible papers
grep -oE '<article class="?pub-item[^>]* data-tab=' public/publication/index.html | wc -l   # same number
grep -oE 'class="?pub-group' public/publication/index.html | wc -l                 # = number of research areas with an article (5)
ls public/robots.txt public/sitemap.xml public/llms.txt
grep -rlE 'PLACEHOLDER|journal_article' public/      # empty
grep -rhoE 'url\([^)]*woff2' public/index.html        # only fonts/… (plus the theme's dist/font/Inter line)
grep -rl '/talk/' public/                             # empty: there is no Talks section
grep -c 'id=research-net' public/index.html           # 1, and #net-data holds 5 area nodes + one per visible paper
grep -rl 'btn--explore' public/ --include='*.html'    # only the pages whose static/explore/<slug>/index.html exists
grep -L 'lg-sitebar' static/explore/*/*.html          # empty: every explore page carries the site bar
ls public/explore/*/plan.md 2>/dev/null               # empty: design notes are not published
git ls-files | grep -E 'plan\.md|NOTES-PRIVATE'           # empty: private notes are not tracked
for d in static/explore/*/; do node tools/explore-probe.mjs "$d" | head -1; done   # every line ends in "0 ERROR"
```

Then look at the homepage (map: hover a dot, tab through the dots), the Research page (switch tabs, use the hash), one paper page with events and an award (Cite, Presented at, Awards, See also) and the Bio page (Other presentations) in both colour schemes, at phone width and desktop.
