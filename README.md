# Factura — Obsidian Innovations

Offline PWA that generates the OBSI invoice PDF. TypeScript, no framework,
jsPDF for the PDF. Everything runs in the browser; nothing is uploaded anywhere.

## Run

    just build     # typecheck + bundle into dist/
    just serve     # http://localhost:4173

All asset paths are relative, so it works from a repo subpath
(`https://aoprisan.github.io/fac/`) without configuration.

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`, which typechecks,
builds, and publishes `dist/` to GitHub Pages. There is no `gh-pages`
branch — the artifact goes straight from the build job to Pages.

One-time repo setup: **Settings → Pages → Build and deployment → Source:
GitHub Actions**. The workflow can also be run by hand from the Actions
tab (`workflow_dispatch`).

Once live:

    https://aoprisan.github.io/fac/                          the PWA
    https://aoprisan.github.io/fac/factura-standalone.html   single file, offline

## Files

    src/model.ts     data model, date/number helpers, the defaults
    src/pdf.ts       the jsPDF layout — the only file to touch for the PDF
    src/storage.ts   persistence (Claude artifact storage → localStorage → memory)
    src/main.ts      form rendering and wiring
    index.html       shell + styles
    public/          manifest, service worker, icons

## Notes

- **Defaults live in `defaults()` in `src/model.ts`.** Editing a field in the
  app also saves it as your new default; "Revino la valorile din fabrică"
  clears that and falls back to the code.
- **Invoice number** is a pattern (`OBSI-{YYYY}{MM}`) expanded from the invoice
  date. Type over it and it stops auto-updating.
- **Scadent** = the 2nd of the month after the invoice date, recomputed whenever
  the date changes. The day is configurable; it clamps to the last day of the
  target month and rolls the year over correctly.
- **RON total** is rounded **up** to the whole leu, matching the existing invoices.
- **Curs valutar** is manual. The BNR button tries `bnr.ro/nbrfxrates.xml`
  directly, which usually fails CORS — if you want it automatic, put a small
  proxy in front of it and change the URL in `fetchRate()`. BNR also only
  publishes today's rate there; the previous-day rate you actually need comes
  from `bnr.ro/files/xml/years/nbrfxrates<YEAR>.xml`.
- **Diacritics** are folded (ș → s) before hitting the PDF, because jsPDF's
  built-in Helvetica is WinAnsi. Embed a TTF in `src/pdf.ts` if you ever need
  real Romanian characters.
- **Not yet handled:** VAT lines (the template is reverse-charge/no-VAT),
  multi-page overflow if you add ~20+ product lines, and e-Factura XML.
