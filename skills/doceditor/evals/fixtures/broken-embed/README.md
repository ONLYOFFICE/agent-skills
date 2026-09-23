# docs-portal

Internal document portal. Serves the files in `storage/` and opens them in the
ONLYOFFICE editor running at `DOCS_URL`.

```
npm install
DOCS_URL=http://localhost:8080 \
PUBLIC_URL=http://host.docker.internal:3000 \
ONLYOFFICE_JWT_SECRET=... \
npm start
```

Then open <http://localhost:3000/editor.html?file=report.docx>.
