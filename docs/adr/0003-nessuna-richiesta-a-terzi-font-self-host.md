---
status: accepted
---

# Font self-hostati e analytics senza cookie: nessuna richiesta a terzi dalle pagine

Il Sito è servito dalla Germania a un pubblico europeo: il Landgericht München I (20 gennaio 2022, 3 O 17493/20) ha giudicato illecito caricare Google Fonts da remoto senza consenso, e un cookie banner è esattamente il tipo di rumore che il registro sobrio del Sito non vuole. Quindi i font del Sito (Vollkorn e Geist) stanno in `static/fonts/` come woff2 con `@font-face`, nessun `<link>` a fonts.googleapis.com anche se Hugo Blox e la Spec King lo proporrebbero per default, e l'unica analytics è Cloudflare Web Analytics, che non usa cookie né identificatori. Scartati: Google Fonts remoto (comodo ma illecito senza consenso), Google Analytics come nei tre Siti esempio (richiede banner), nessuna analytics (accettabile, ma Cloudflare è già nello stack a costo zero).
