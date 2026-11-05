---
status: accepted
---

# Repo pubblico senza note private; la storia pubblica parte da un solo commit

GitHub Pages su un account gratuito serve soltanto repo pubblici, quindi tutto ciò che git traccia è leggibile da chiunque, storia compresa. Durante la costruzione erano entrati nel repo due tipi di appunti che pubblici non devono essere: l'elenco delle cose da ricontrollare (link non verificati, differenze tra un abstract e il suo manoscritto) e i `plan.md` degli Esplorabili, che in coda riportano le incongruenze notate nei paper. Quindi restano solo sul computer da cui si modifica il Sito, ignorati da git (`NOTES-PRIVATE.md`, `static/explore/*/plan.md`), e la storia pubblica riparte da un commit unico: i commit precedenti, che quegli appunti li contenevano, restano nel ramo locale `local-history`, che non va mai pubblicato. Scartati: repo privato (Pages non lo serve senza un piano a pagamento), ripulire la storia file per file (fragile, e i messaggi di commit ne citavano comunque i dettagli), lasciare tutto pubblico (sono note di lavoro su paper propri e di coautori).
