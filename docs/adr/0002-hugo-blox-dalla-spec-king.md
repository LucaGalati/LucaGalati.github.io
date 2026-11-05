---
status: accepted
---

# Hugo + Hugo Blox generati dalla Spec King, unicità in custom.css

Il Sito deve riusare i Motori dei Siti esempio e tutte le loro Funzioni, non solo lo stile, e insieme avere colori e font propri. Scelto Hugo extended + Hugo Blox (`blox-tailwind`) + Pagefind, generati dalla Spec King (la stessa del sito di Wulff), con palette, font self-hosted e home personalizzati in `assets/css/custom.css` e nei layout override, come fa Wulff. Scartati: Hugo senza tema con CSS a mano (più unico e leggero, ma ricerca, See-also e JSON-LD da riscrivere), Quarto (look Bootstrap difficile da rendere unico), HTML puro à la Bäckman (20+ pubblicazioni da duplicare a mano). Conseguenza: la CI richiede Node (Tailwind CLI) oltre a Hugo; il tema è vendored in `_vendor/`.
