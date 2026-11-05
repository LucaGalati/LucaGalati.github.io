# Updating the website

The site is Markdown files plus a few small data files. You do not need to run anything: edit a file on GitHub, commit to `main`, and GitHub Actions rebuilds and redeploys the site in about two minutes. The technical playbook is in `WEBSITE_PRINCIPLES.md`; this file is for everyday edits.

Live address: https://lucagalati.github.io/ (becomes https://lucagalati.com/ after the domain switch, see below).

## The 30-second mental model

- Every paper is a folder `content/publication/<slug>/` with one file, `index.md`. The front matter (the block between the `---` lines) holds all the data; the site reads nothing else.
- The folder name is the permanent web address: `content/publication/no-fee-trading/` is `/publication/no-fee-trading/`. Never rename a folder once the site is live; people and search engines have the link. To fix a title, edit `title:` and keep the folder.
- Where a paper was presented lives in the same file, under `events:`; there is no separate Talks section. Presentations of work that is not on the site go in `data/other_presentations.json` (shown on the Bio page).
- Everything else is computed at build time from those files: the Research page tabs and filters, the homepage accordions and the research-area map, the "See also" lists, BibTeX, Google Scholar metadata, the search index. Add a file and it slots itself in.
- Every push to `main` rebuilds the whole site. There is nothing to cache, clear or restart.

To create a paper on GitHub: open `content/publication/`, click "Add file" > "Create new file", type `my-new-slug/index.md` as the name (the slash creates the folder), paste the template below, commit. To add a PDF: open `static/files/`, "Add file" > "Upload files".

## Add a working paper

Copy this into `content/publication/<slug>/index.md` and fill it in. Slugs are lowercase, hyphenated, short (`auctions-retail-options`).

```yaml
---
title: "Not Dead Yet: Options Trading Floors"
date: 2026-07-29
authors: ["Luca Galati", "Terrence Hendershott", "Saad Ali Khan", "Ryan Riordan"]
publication_types: ["report"]
publication: "Working paper"
journal: ""
volume: ""
issue: ""
pages: ""
article_number: ""
doi: ""
status: "in_preparation"
tab: "working-papers"
areas: ["market-design"]
tags: ["options", "floor trading", "liquidity"]
group: "market-design"
weight: 1
jmp: false
award: ""
ranking: ""
url_pdf: "files/options-trading-floors.pdf"
url_ssrn: "https://www.ssrn.com/abstract=6850360"
url_code: ""
url_slides: ""
url_podcast: ""
abstract: "One paragraph. Markdown is allowed. Avoid unescaped double quotes inside the string."
events:
  - name: "Munich Finance Day"
    organizer: "Ludwig Maximilian University of Munich"
    city: "Munich"
    country: "Germany"
    online: false
  - name: "The Microstructure Exchange Fall 2026 Virtual Seminar"
    organizer: ""
    city: ""
    country: ""
    online: true
draft: false
---
```

What each field does:

| Field | Meaning |
|---|---|
| `title` | Shown everywhere. Keep the folder name even if the title changes. |
| `date` | ISO date. Sets the year printed after the venue, the Year filter and the BibTeX `year`. The position in the Research list comes from `weight`, not from the date (see "Order of the Research list"). For a working paper use the date of the current draft. |
| `authors` | Exact names, in paper order, your own included. The paper page prints them all under the title, with "Luca Galati" marked as the owner. The rows of the Research page and of the homepage put the title first and then "with" the co-authors only, so your name is not repeated on every row (a single-authored paper has no "with" line). The other names link out when `data/coauthors.json` has a `url` for that exact spelling. |
| `publication_types` | `["report"]` for working papers, `["journal_article"]` for articles, `["thesis"]` for theses. Nothing on the site displays it; `thesis` switches the BibTeX type and the Google Scholar tags. |
| `publication` | The one-line venue string printed in bold in lists and on the paper page, e.g. `"Journal of Banking & Finance 165, 107222"`. Working papers carry `"Working paper"`; keep it, it is what labels those rows on the Research page (printed plain, not bold: bold is for journal names). |
| `journal`, `volume`, `issue`, `pages`, `article_number` | Structured bibliographic data: BibTeX and Google Scholar `citation_*` tags. Empty strings for working papers. `pages` as `"105-132"`. |
| `doi` | Bare DOI, no `https://doi.org/`. Produces the "Article" button, `citation_doi` and the BibTeX `doi`. A working paper may carry its SSRN DOI (`10.2139/ssrn.…`); the Article button is then hidden everywhere because the SSRN button already covers it. |
| `status` | `published`, `in_preparation` or `forthcoming`. Only `forthcoming` changes anything visible: a "Forthcoming" badge on list rows, the venue line on the paper page becomes "Forthcoming, *Journal*", and BibTeX adds `note = {Forthcoming}`. |
| `tab` | `working-papers`, `articles` or `theses`. This decides the Research tab, the badge and the BibTeX type (`@unpublished` vs `@article`). |
| `group` | The research-area id whose heading the row sits under on the Research page: one of the `areas` ids below. See "Order of the Research list". |
| `weight` | Position in the Research list, 1 = top. See "Order of the Research list". |
| `letter` | `true` on short papers (Finance Research Letters, Economics Letters, Applied Finance Letters): a small "Letter" badge after the venue on the Research rows, the homepage rows and the paper page. Nothing else changes. Omit otherwise. |
| `areas` | Research-area ids for the Research page filter and "See also": `market-design` (Market design and microstructure), `fx-benchmarks` (FX benchmarks and execution), `crypto` (Crypto and decentralised markets), `networks` (Networks and price discovery), `accounting-esg` (Accounting, governance and ESG). A paper may have several. |
| `tags` | Free keywords. Used for "See also" scoring and as `keywords` in the page's structured data; not displayed. |
| `jmp` | `true` adds the outlined gold "Job market paper" badge (currently on `options-trading-floors` and `no-fee-trading`). Omit or `false` otherwise. |
| `award` | Optional text; renders as a badge line on the homepage and the Research list, and as the "Awards" section of the paper page (under the presentations). |
| `ranking` | Published articles only, e.g. `"SJR Q1, AJG 3, ABDC A*, Anvur A, VHB A"` (VHB is the German rating, VHB Rating 2024, and goes last, after Anvur); a small muted line on the paper page only. An article in the Journal of Finance, the Journal of Financial Economics or the Review of Financial Studies shows no ranking line, whatever the field holds: the top three need none. Working papers leave it empty, and the journal a working paper is aimed at is written nowhere in this repository, which is public. |
| `url_pdf` | `files/<name>.pdf` with no leading slash. Put the PDF in `static/files/`. Also feeds `citation_pdf_url` for Google Scholar. A full `https://…` URL works too and opens in a new tab. |
| `url_ssrn`, `url_code`, `url_slides`, `url_podcast` | Full URLs. Each present field produces one button (SSRN, Code, Slides, Podcast). |
| `url_presentation` | Full URL of a talk's own page (a recorded seminar, say). Produces the "Presentation" button right after "Explore the paper" on the paper page and on the list rows. Currently on `options-trading-floors` (The Microstructure Exchange, 13 October 2026). |
| `abstract` | Shown under "Abstract" on the paper page and searched by the Research page filter. An empty abstract hides the Abstract button. |
| `events` | Optional list of presentations, shown under "Presented at" on the paper page, below the abstract. Each item has `name`, `organizer`, `city`, `country`, `online` and renders as "Name, Organizer, City, Country"; `online: true` replaces city and country with "online"; empty fields are skipped. An optional `url` (the talk's own page, with its recording or slides) turns the name into a link. Newest first by convention. Omit the key (or leave the list empty) and the section disappears. |
| `draft` | `true` hides the paper from the site entirely (no page, no list, no search). |

Then add the slug to the right area in `data/research_areas.json` so it appears on the homepage (see "Research areas"). The Research page picks it up without that step; give it `group` and `weight` so it lands in the right place (a new working paper takes `weight: 1` and every other row moves down by one).

## Add a published article

Same template; the fields that differ:

```yaml
publication_types: ["journal_article"]
publication: "Journal of Banking & Finance 165, 107222"
journal: "Journal of Banking & Finance"
volume: "165"
issue: ""
pages: ""
article_number: "107222"
doi: "10.1016/j.jbankfin.2024.107222"
status: "published"
tab: "articles"
```

`date` is the publication date; when only the month is known, use the first of that month. Add `letter: true` for a short paper in a letters journal.

## Add a thesis

Same template; a thesis is a folder like any paper (`content/publication/phd-thesis-market-microstructure/`). The fields that differ:

```yaml
publication_types: ["thesis"]
publication: "PhD dissertation, University of Wollongong"
journal: ""
doi: "10.71747/uow-r3gk326m.28192649"
status: "published"
tab: "theses"
areas: ["market-design", "crypto"]
group: "market-design"
weight: 27
degree: "PhD dissertation"
institution: "University of Wollongong"
url_full: "https://doi.org/10.71747/uow-r3gk326m.28192649"
award: "Examiners’ Commendation for Outstanding Thesis, University of Wollongong"
abstract: ""
```

- `tab: "theses"` puts it under the Theses tab (and at the end of "All"); theses never appear on the homepage, because `data/research_areas.json` does not list them, and they get no group heading on the Research page.
- `publication` is the bold venue string of the Research row: "Luca Galati (2024). Title. **PhD dissertation, University of Wollongong**." The paper page prints `degree`, `institution` and the year instead.
- `degree` is one of `PhD dissertation`, `Doctoral dissertation`, `Master dissertation`, `Bachelor dissertation`. It picks the BibTeX type: `@phdthesis` for the first two, `@mastersthesis` for a Master, `@misc` with `note = {Bachelor dissertation}` otherwise; `institution` becomes `school`, `url_full` becomes `url`.
- `url_full` is the repository or full-text link; it renders as a "Full text" button (new tab) on the row and the page. A thesis `doi` is kept for BibTeX and Scholar but produces no "Article" button, since "Full text" already points there.
- `abstract` may stay empty: the Abstract button and section are simply absent. `award` works as for papers.
- Google Scholar gets `citation_dissertation_institution` instead of a journal title, and the page's structured data is a `Thesis` with `inSupportOf` = `degree`.

## Order of the Research list

Rows are sorted by `weight` (ascending, 1 at the top), never by date. The files follow this convention, which the headings on the page assume:

1. working papers, newest first;
2. articles, grouped by research area in the order of `data/research_areas.json` (market-design, fx-benchmarks, crypto, networks, accounting-esg), newest first within a group;
3. theses, newest first.

`group` is the one area id the row is filed under (unlike `areas`, which may list several and only feeds the filter and "See also"). The Research page prints a heading ("Market design and microstructure", …) before the first article of each group, so keep the articles of one group next to each other. Working papers and theses carry a `group` too, but get no heading.

To move a row, change its `weight` and renumber the rows it passes; a gap in the numbering is harmless, a missing `weight` sends the row to the bottom, and two rows with the same `weight` fall back to date, newest first. "Newest first" in the Sort dropdown of the Research page is exactly this order; "Oldest first" and the title sorts flatten the list and hide the headings.

## Move a working paper to published

Edit the existing `index.md` (keep the folder):

1. `tab: "articles"`, `publication_types: ["journal_article"]`, `status: "published"` (or `"forthcoming"` with `journal` filled in, while it is accepted but not yet in an issue).
2. Fill `publication`, `journal`, `volume`, `issue`, `pages` or `article_number`, `doi`; set `date` to the publication date. Add `letter: true` if it is a letter.
3. Fill `ranking` as in the other articles (the top three finance journals show none, see the table above). Keep `url_ssrn` if you want the preprint button to stay.
4. Give it the `weight` of the first article of its `group` and shift the rest of the list down by one (see "Order of the Research list").
5. In `data/research_areas.json` move the slug below the remaining working papers in its area lists, if you keep the convention "working papers first".

The `events:` list travels with the paper, nothing else to update.

## Add a presentation

For a paper that is on the site, append to the `events:` list in its `content/publication/<slug>/index.md` (create the key if the paper has none):

```yaml
events:
  - name: "Munich Finance Day"
    organizer: "Ludwig Maximilian University of Munich"
    city: "Munich"
    country: "Germany"
    online: false
  - name: "The Microstructure Exchange Fall 2026 Virtual Seminar"
    organizer: ""
    city: ""
    country: ""
    online: true
    url: "https://microstructure.exchange/talks/2026-10-13"
```

It appears on the paper page under "Presented at", right below the abstract, followed by the "Awards" section when `award` is set. `url` is optional: when the talk has a page of its own (a recording, the slides), the event name links to it. Indent exactly as above (two spaces, then `- name:`); a bad indentation is the usual cause of a red build.

For a presentation of work that is not on the site (a paper that was never posted, a discussion, a doctoral symposium), add an item to `data/other_presentations.json`, newest first:

```json
{
  "title": "The Impact of Cyber-Attacks on Financial Markets Quality",
  "authors": ["Luca Galati"],
  "year": 2022,
  "events": [
    { "name": "AFAANZ Doctoral Symposium", "organizer": "Accounting and Finance Association of Australia and New Zealand & Monash University Business School", "city": "Melbourne", "country": "Australia", "online": false }
  ]
}
```

These show on the Bio page under "Other presentations" (after Service), with the same event format. Mind the commas between items; JSON has no trailing comma.

## Explore pages

A paper can carry an interactive explanation in `static/explore/<slug>/`, with `<slug>` the paper's folder name. When `index.html` exists there, the paper page gets an "Explore the paper" button first in its button row, and the Research list and the homepage rows get an "Explore" mini button; when it does not, nothing is shown, there is no switch to flip. To retire one, delete the folder.

Each folder is a small site of its own: `index.html` is the hub, the numbered pages are the decks, and the CSS and JavaScript sit beside them. Everything is self-contained (fonts via `../../fonts/`, no third-party requests, progress kept in the browser's local storage) and every page links back with `../../publication/<slug>/`. The `plan.md` next to them is the design document of that explorable (its slides, bets and the notes for the author); `hugo.yaml` keeps every `plan.md` out of the published site and `.gitignore` keeps it out of the repository, so these notes exist only on your computer.

The bar at the top of every explore page ("Luca Galati" for the home page, "Research", "This paper") is one shared file, `static/explore/sitebar.js`: change a label or a colour there and every explorable follows. A page gets the bar from two lines, `<script src="../sitebar.js"></script>` in its `<head>` and `<lg-sitebar></lg-sitebar>` as the first thing in its `<body>`. After touching an explorable, `node tools/explore-probe.mjs static/explore/<slug>` opens all its pages in a hidden Chrome at four screen sizes and must end in "0 ERROR".

Seven papers have one (the six visible working papers and "No-fee trading"), each at version 2.0 after a judged pass of 5 November 2026. They were built with the explorable-explanations skill from the manuscripts; new ones for the published articles follow the same recipe once the format is approved.

## Edit the bio, intro, teaching and CV

- Bio (Bio & CV page): the Markdown body of `content/bio/_index.md`. The photo is `assets/images/luca-galati-portrait.jpg`, a 3:4 portrait (660×880 px, shown on Home and Bio only; the square `luca-galati.jpg` beside it is the old crop and is no longer used). To replace it, keep the file name and the 3:4 proportion; the build resizes it. If the file is missing, an "LG" monogram takes its place.
- Homepage intro: the `intro:` string in `content/_index.md`. One or two sentences in the first person, kept essential (your choice of 5 November 2026; it used to be a longer paragraph in the third person).
- Teaching: the intro paragraph is the body of `content/teaching/_index.md`; the courses are `data/teaching.json`, an ordered array. Rendered fields: `title`, `institution`, `roles` (list of `{"role": "...", "term": "..."}`), `level`, `description` (Markdown). `institution_cv`, `term_cv`, `title_cv`, `title_google`, `semester`, `years_offered` and `country` are notes carried over from the migration and are not displayed.
- CV sections on the Bio page come from `data/cv.json`: `employment` (shown under "Appointments") and `appointments` (shown under "Other appointments"; both use `years`, `position`, `institution`, `location`), `education` (`degree`, `institution`, `location`, `start_year`, `end_year`, `thesis`, `advisors`, `notes`), `honors` ("Awards and grants": `year`, `title`, `organization`, `amount`), `service` (`years`, `position`, `organization`, `location`), `peer_review` and `memberships` (plain lists of strings). `header` and `development` are not rendered. The rows follow the printed CV: the role, the degree or the award is in bold, the place comes after a dash. In `education` the `notes` are the grade or distinction, printed right under the degree on a line of their own. In `honors` keep the entries of one year next to each other: the year is printed once, on the first of them, and `amount` sits in a column on the right.
- CV PDF: replace `static/files/luca-galati-cv.pdf` keeping the file name; the "Download CV (PDF)" button points at it.
- Contact details, profile links, role and tagline: `params` in `hugo.yaml`. Interface labels ("Working papers", "Download CV (PDF)", …): `i18n/en.yaml`.

## Research areas

`data/research_areas.json` is a list of areas, in display order:

```json
{ "id": "networks", "name": "Networks and price discovery", "summary": "One sentence.", "papers": ["mtd-portfolio-optimization", "ftx-information-flow"] }
```

- The homepage shows one accordion per area, in file order, listing exactly the slugs in `papers`, in that order (convention: newest first, working papers before articles). A slug that does not exist or is a draft is skipped silently. The "N papers" count follows.
- The map above the accordions is drawn from the same file: one large dot per area, one small dot per paper (larger for the job market papers), a line for each area a paper belongs to. Nothing to maintain; a paper listed under two areas sits between them. The drawing itself is in `layouts/index.html` (see `WEBSITE_PRINCIPLES.md`, "Research-area map") if the spacing ever needs a nudge.
- Where each area sits on the map is `map_order` at the top of the file: the area ids clockwise from the top. It is independent of the accordion order: accounting sits apart at the bottom right, crypto on the left next to networks, with which it shares papers. A new area must be added to `map_order` too; an id missing from it falls back to its position in the list and may land on another area.
- The same list fills the "Research area" dropdown on the Research page, but that filter matches a paper's own `areas:` front matter, not these `papers` lists. Keep the two consistent: when you add a paper, set `areas:` in its file and add its slug here.
- Do not change an `id` without changing every `areas:` entry that uses it.

## Co-author links

`data/coauthors.json` maps an author name (exactly as written in `authors:`) to `{ "url", "type", "affiliation" }`. Only `url` is used: when present, the name links to it from every citation. `type` and `affiliation` are notes.

The rule for a link: the person's own page, best first a personal website, then the profile page at the current university or employer (for Italian universities the department's "docente" page, never the central phone-book entry), then Google Scholar or ORCID when nothing else exists.

All 31 links were checked on 5 November 2026: for each name one search looked for the best page, a second, independent one tried to refute it, and the pages that refuse automated reading were opened by hand. Seven changed (Salvatore Perdichizzi to his page at the Padua department, Alex Frino to Notre Dame Australia, Carmine Russo and Matteo Merlo to their personal sites, and first links for Matteo Benenchia, Alexander Webb and Dionigi Gerace). Two names still have no link (`"url": null`) because no page could be verified: Robert Gaudiosi and Paulo Alves. To add one, replace `null` with the page address in quotes. To stop linking someone, set `url` to `null` or delete the entry.

## Hidden working papers

`draft: true` keeps a paper out of the site while the file stays in the repo. One is hidden now: `motif-price-leadership`. To publish one: set `draft: false`, add the abstract and links, and add the slug to `data/research_areas.json` (it then also appears on the homepage map).

## Resources section

`content/resources/_index.md` exists with `draft: true` and is not in the menu. To switch it on:

1. Remove the `draft: true` line and write the page body in Markdown. Individual resources can be folders `content/resources/<slug>/index.md` with `title` and `summary`; the page lists them.
2. Add a menu entry in `hugo.yaml` under `menu.main`:

```yaml
    - name: "Resources"
      url: /resources/
      weight: 50
```

The breadcrumb label `section_resources` already exists in `i18n/en.yaml`.

## Changing fonts or colours

- Colours: the token block at the top of `assets/css/custom.css`. Light values live in `:root`; dark values appear twice, under `@media (prefers-color-scheme: dark)` and under `html.dark, [data-theme="dark"]`. Change all three places.
- Gold (`--color-gold`) is the one warm accent and it is used sparingly, as a mark rather than a surface: the owner's name in author lists, the job-market badge, the active tab underline and a few small rules and dots (the research-area map, the Explore button). Each use is a short block in `custom.css` with a comment naming it, so a gold touch can be removed or added in one place. It stays a border, fill or short highlight, never running text on the light background.
- Fonts: the font stacks are `--font-serif` (Vollkorn: name, headings, paper titles, running text) and `--font-sans` (Geist: navigation, metadata, buttons, badges, CV rows, footer) in the same block. The font files are `static/fonts/*.woff2` and are declared in `layouts/_partials/hooks/head-end/fonts.html` (the `$faces` list: family, style, weight range, file name; plus two `preload` links). To swap a font, add the `.woff2` files to `static/fonts/`, edit the `$faces` entries and the stacks, and delete the old files.
- Fonts must stay self-hosted. Never add a `fonts.googleapis.com` link or any other third-party stylesheet or script (`docs/adr/0003`, a German court ruling on remote Google Fonts).
- Browser-tab icon: the letters LG in gold on a blue square. The build makes it from `assets/media/icon.png` (512×512); `static/favicon.svg` is the drawing it was rendered from, and `static/favicon-16x16.png`, `favicon-32x32.png` and `apple-touch-icon.png` are the same picture at fixed sizes. To change a colour, edit the two `fill` values in the SVG and export the PNGs again at those sizes.
- Running text (the bio, the Teaching page, abstracts, the homepage intro) is set like a paper: it runs the full width and is justified and hyphenated from 640px up (the block right under the running-text fonts in `custom.css`); on phones it stays ragged, because justified lines that short open gaps between words.

## Analytics

Cloudflare Web Analytics is the only analytics and it is off until you add a token. In `hugo.yaml`:

```yaml
  analytics:
    cloudflare_token: ""   # paste the token from Cloudflare > Web Analytics > Add a site
```

Empty means no script is emitted at all. The token is not a secret (it is visible in the page source). No cookies, no banner needed.

## Footer credit and discovery metadata

Both are on, as the site spec defaults:

```yaml
  mysite:
    credit: true       # footer line "Created using GaryKing.org/mysite"
    discovery: true    # invisible <meta name="generator"> and homepage Person JSON-LD
```

Set either to `false` in `hugo.yaml` to remove it.

## Custom domain (lucagalati.github.io to lucagalati.com)

1. In `hugo.yaml` set `baseURL: "https://lucagalati.com/"`.
2. Create `static/CNAME` containing one line: `lucagalati.com`.
3. Cloudflare DNS for `lucagalati.com`, all records with the proxy off (grey cloud, "DNS only"):
   - `A` `@` → `185.199.108.153`
   - `A` `@` → `185.199.109.153`
   - `A` `@` → `185.199.110.153`
   - `A` `@` → `185.199.111.153`
   - `CNAME` `www` → `lucagalati.github.io`
4. GitHub: repository `LucaGalati/LucaGalati.github.io` > Settings > Pages > Custom domain: `lucagalati.com`, Save, wait for the DNS check, then tick "Enforce HTTPS" (it becomes available after the certificate is issued, up to an hour).
5. Commit steps 1 and 2 together. `https://lucagalati.github.io/` keeps working as a redirect (`docs/adr/0001`).

## Previewing locally

```bash
brew install hugo        # Homebrew's build is the extended one
npm install              # once, in the repo root: Tailwind CLI and Pagefind
hugo server              # http://localhost:1313/ , reloads on save; add -D to see drafts
```

Search only works on a full build, because the index is built after Hugo:

```bash
hugo --gc --minify && npx pagefind --site public && cd public && python3 -m http.server 8787
```

then open http://localhost:8787/. `public/`, `resources/_gen/`, `hugo_stats.json` and `node_modules/` are build output and are ignored by git.

## Things to check after a change

- The Actions tab of the repository: the latest "Deploy Hugo site to Pages" run must be green. A red run usually means a YAML error in a front matter (an unescaped `"` inside a string, a missing closing `---`, bad indentation of the `events` list) or a missing comma in `data/other_presentations.json`. Open the run, read the Hugo error line, fix the file.
- The page itself in a private browser window, so you are not looking at a cached copy. Search results appear only after the deploy finished.

## Known items to review

The list of facts to double-check (links that could not be verified, dates, places where an abstract and its manuscript differ, notes on single papers) is kept out of this repository, which is public. It is `NOTES-PRIVATE.md`, next to this file on the computer the site is edited from; git ignores it. The design notes of each explore page (`static/explore/<slug>/plan.md`) are local-only in the same way.
