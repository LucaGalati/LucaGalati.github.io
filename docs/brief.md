# Brief di build — lucagalati.com

Decisioni prese nell'intervista del 2 novembre 2026. È l'input per la costruzione del Sito con la Spec King; i termini sono quelli di `CONTEXT.md`, le scelte difficili da invertire sono in `docs/adr/`.

## Identità e infrastruttura

- Dominio: `lucagalati.com`, comprato a prezzo di costo su Cloudflare Registrar (DNS Cloudflare). Registrazione e pagamento li fa Luca. `lucagalati.me` risulta registrato da terzi (Namecheap, gennaio 2023, scade gennaio 2027): da chiarire se è suo.
- Hosting: GitHub Pages dal repo utente `LucaGalati/LucaGalati.github.io` (pubblico), file `CNAME`, deploy GitHub Actions. `lucagalati.github.io` resta come redirect. Con Cloudflare DNS davanti a GitHub Pages: proxy spento sui record del sito (o SSL "Full"). Vedi ADR 0001.
- Motore: Hugo extended + Hugo Blox (`blox-tailwind`, vendored) + Pagefind, generato dalla Spec King (`ACADEMIC_SITE_PROMPT.md` di Gary King, copia locale scaricata il 2 novembre 2026); CI con Node per Tailwind. Unicità in `assets/css/custom.css` e nei layout override, come fa Wulff. Vedi ADR 0002.
- Il Sito Google resta intatto e online; nessun redirect da lì.

## Pagine

Nav: **Home · Bio & CV · Research · Teaching · Talks**. Contatti nel footer e in Bio, non pagina a sé.

- Home: intro in terza persona (2–4 frasi, diversa dalla bio), foto, profili, Research areas a fisarmonica con i paper dentro, ultimi Working paper.
- Bio & CV: bio lunga, timeline posizioni (Berkeley 2027, LMU/DFCRC 2025–, Bologna 2024–25, Florida Poly 2023, Rozetta 2021–24, LSEG 2021–24, 110 Laude 2021–23), formazione, premi e grant (~20), servizio (AE a RIBAF, comitati SBFC e CRC), CV PDF.
- Research: tab Working papers (8, due con badge JMP) e Articles (19); ogni paper ha pagina propria con abstract a click, PDF, SSRN, DOI, codice, slide, podcast; "See also" automatici.
- Teaching: 7 corsi con descrizioni (testi già sul Sito Google).
- Talks: ~25 presentazioni 2021–2026 dal CV, raggruppate per paper.
- Resources: sezione predisposta ma fuori dal menu e non pubblicata (`draft`), attivabile con una riga.
- Niente blog, niente pagine coautori automatiche (disattivare la generazione della Spec King), niente Datasets/Startups/Media/Software come pagine.

Fonti dei contenuti: `grants/EUROFIDAI/Luca_Galati_CV_Academic/cv/*.tex` (pubblicazioni, talk, teaching, premi, impieghi), Sito Google (bio, descrizioni corsi, abstract), foto in `grants/EUROFIDAI/Luca_Galati_CV_Academic/` (`profile.png`, `LG_profile_copy.jpg`).

## Palette (personale, slegata dall'LMU)

| Ruolo | Chiaro | Scuro |
|---|---|---|
| Sfondo | `#FCFBF8` carta calda | `#0B1A2E` blu notte |
| Superficie / card | `#F3F0E8` | `#13263F` |
| Testo | `#1C1C1A` | `#E8EDF3` |
| Testo secondario | `#5A5A56` | `#A7B3C2` |
| Accento: link, nome, titoli | `#003262` Berkeley Blue | `#8EC1E6` |
| Secondario: badge, sottolineature | `#FDB515` California Gold | `#FDB515` |
| Testo sull'oro | `#003262` | `#0B1A2E` |
| Filetti | `#D9D6CE` | `#23395A` |

Regole: l'oro è solo riempimento o contorno, mai testo su chiaro (contrasto 1,7:1). Dark mode automatica da `prefers-color-scheme`, senza toggle.

## Tipografia

- Titoli (nome, h1–h3, titoli dei paper) e testo corrente (abstract, bio, corsi): **Vollkorn** variabile 400–900 con corsivo (Friedrich Althausen, SIL OFL). Nome ~46–50px peso 500, h2 ~24px, corpo 17px / 1,6, misura ≤ 62ch.
- Menu, metadati, bottoni, badge, tab, filtri, righe CV, footer: **Geist** variabile 100–900 con corsivo (Vercel, SIL OFL). Menu 12,5px maiuscole con tracking 0,11em; metadati 14,5px; cifre `tabular-nums`.
- Scelta finale del 2 novembre 2026, al posto di Instrument Serif + Instrument Sans (provino 2, coppia 02) dopo un ripensamento sui provini: Luca "preferisce" Vollkorn + Geist; gli piacciono anche Alegreya + Alegreya Sans, Brygada 1918 + Onest e Funnel Display + Funnel Sans (alternative pronte se si vuole cambiare registro).
- Self-hosting obbligatorio (sentenza LG München 2022 su Google Fonts remoti): woff2 in `static/fonts/`, `@font-face` con `font-display: swap`, nessuna richiesta a fonts.googleapis.com.
- Registro "serio" scelto sul provino 2: pesi medi e non bold, molta aria, filetti sottili al posto delle card, badge JMP in contorno oro con testo maiuscolo spaziato, colonna stretta.

Scartati con motivo: Google Fonts "comuni" (Newsreader rifiutato esplicitamente, Inter, Merriweather, Charter); il primo provino di fonderie indipendenti (Excon, Plein, Cabinet Grotesk, Author, Karrik, Uncut Sans, Coconat, Cooper Hewitt, Apfel Grotezk, Absans, Luciole, Ranade, Supreme) giudicato "cartonato e poco serio"; nel provino 2 Switzer, Sentient, Gambetta, General Sans, Erode. Provino pubblicato: https://claude.ai/artifact/Ji2e9oifQpurUQGu9CNiZJ (privato).

## Research areas (ordine = peso in Home)

1. **Market design and microstructure** — options floors, auctions for retail options, block and off-market trades, centralising bond markets, war and liquidity, no-fee trading.
2. **FX benchmarks and execution** — WM/R fix, 4pm fix, benchmark windows.
3. **Crypto and decentralised markets** — EIP-1559, FTX, stablecoins and SVB, memecoins, delayed block trades.
4. **Networks and price discovery** — motifs leadership measure, MTD portfolio, FTX information flow.
5. **Accounting, governance and ESG** — Benford and elections, municipally owned entities, DEI, social tone, ESG tone and cost of debt.

## Default confermati

- Analytics: Cloudflare Web Analytics (senza cookie, nessun banner). Niente Google Analytics. Vedi ADR 0003.
- PDF dei paper nel repo (`static/papers/`), non su Drive; podcast NotebookLM come link esterni.
- Profili: Email, Google Scholar, ORCID, SSRN, GitHub, LinkedIn. Niente X/Twitter.
- Lingua: solo inglese. Footer con "Last updated". Dark mode automatica, nessun toggle.

## Revisione di Luca del 4 novembre 2026 (sul sito costruito)

- Più oro "intorno": filetti corti oro sotto i titoli, sottolineature oro al passaggio del mouse, marcatori oro negli elenchi, bordo oro sui bottoni al passaggio; mai oro come testo su chiaro.
- Nome della rivista in grassetto; il nome di Luca negli elenchi autori come evidenziatore oro (sfondo oro attenuato, testo blu).
- Testo a tutta larghezza del contenitore (niente misura a 62ch).
- Ritratto 3:4 (`assets/images/luca-galati-portrait.jpg`, 660×880) al posto del quadrato; alternativa scartata: foto rotonda.
- Niente pagina Talks: le presentazioni stanno nella pagina del paper sotto l'abstract ("Presented at", con i premi in "Awards"); le tre presentazioni di paper non sul Sito in Bio & CV ("Other presentations").
- Mappa delle aree in Home: grafo di forza in SVG e JavaScript puro (nessuna libreria), aree in oro e paper in blu, hover e click verso il paper; le fisarmoniche restano.
- Esplorabili per paper (skill explorable di Bäckman / Nicky Case): wave 1 per i 7 paper con manoscritto completo (6 Working paper visibili + JBF 2024), self-contained in `static/explore/<slug>/`, bottone "Explore the paper"; wave 2 per gli altri 18 Articoli dopo il giudizio di Luca sul formato.
- CV aggiornato al PDF di novembre 2026 (da Downloads): "Delegated Execution Window" non c'è più ed è stato rimosso; target aggiornati (centralising → JFM, decentralized payments → JFE); aggiunto l'evento FMA 2026 Derivatives and Volatility (Chicago) al floor paper.

## Revisione di Luca del 5 novembre 2026

- Le quattro tesi (PhD Wollongong 2024, Dottorato Molise 2024, Master 2020, Laurea 2019) entrano in Research in una tab "Theses" a parte, ciascuna con il link al testo completo (DOI UOW, IRIS Molise, ResearchGate); non entrano nelle Research area della Home.
- Ordine degli Articoli in Research per Gruppo: microstructure → FX benchmarks → crypto (con le cinque Letter del CV marcate dal badge "Letter") → networks → accounting in coda, a parte; dentro ogni gruppo i più recenti prima; i Working paper restano in testa, le tesi in fondo. Il generatore scrive `group` e `weight`; i template ordinano per `weight`.
- Agenti di verifica (giudici, revisori, fixer) su Opus 5.5, non su Fable.

Seconda serie di note, stesso giorno:

- Mappa delle aree: la posizione degli hub è slegata dall'ordine delle fisarmoniche (`map_order` in `data/research_areas.json`, in senso orario dall'alto). Accounting in basso a destra, a parte; Crypto a sinistra accanto a Networks, con cui condivide paper.
- Tolta la frase di istruzioni sotto la mappa ("Hover a dot…"): suonava scritta da un'AI. L'intro della Home non è stata toccata.
- Link dei coautori: ognuno deve puntare alla pagina personale (sito proprio, poi pagina docente del dipartimento), mai a una voce di rubrica; ricontrollati tutti dopo il caso Perdichizzi (Padova).
- Ranking: i tre top journal di finanza (JF, JFE, RFS) non mostrano riga di ranking; agli Articoli attuali si aggiunge il rating tedesco VHB (VHB Rating 2024) dopo Anvur. Il journal a cui punta un Working paper non compare da nessuna parte nel repo, che è pubblico.
- Testo corrente (Bio, Teaching, abstract, intro di Home) impaginato come un paper: a tutta larghezza, giustificato e sillabato da 640px in su; sui telefoni resta a bandiera. Chiesto per Teaching e poi per la Bio, esteso al resto per coerenza.
- Un Talk può avere un `url` (la pagina dell'evento, con registrazione o slide): il nome in "Presented at" diventa un link. Il primo è il seminario The Microstructure Exchange del 13 ottobre 2026 sul paper del floor.
- Barra del sito in cima a ogni pagina di ogni Esplorabile (Home, Research, This paper): un solo file condiviso, `static/explore/sitebar.js`, controllato da `tools/explore-probe.mjs`.
- Icona del sito: lettere LG in oro sul quadrato blu.

Terza serie di note, stesso giorno:

- Le righe del CV in Bio seguono il CV stampato: ruolo, titolo di studio o premio in grassetto, luogo dopo un trattino; sotto ogni titolo di studio il voto su una riga propria; premi raggruppati per anno (l'anno una volta sola) con gli importi in colonna a destra.
- Più aria tra il bottone "Download CV (PDF)" e il testo della Bio.
- Intro di Home: una frase in prima persona, essenziale, "I am an economist…"; via la frase sui dottorati. Supera la regola della Spec King (intro in terza persona, 2–4 frasi).
- Foto di Home più piccola (160×213), alta quanto il blocco di testo accanto.
- Pubblicazione: le note private restano fuori dal repo, che è pubblico, e la storia pubblica parte da un solo commit. Vedi ADR 0004.

## Da scrivere in fase di build

- Intro di Home (2–4 frasi, terza persona) e bio lunga, testi distinti come esige la Spec King; bozze dal Sito Google, revisione di Luca.
- Repo `LucaGalati/LucaGalati.github.io` da creare; dominio da comprare su Cloudflare; DNS e `CNAME` dopo il primo deploy.
