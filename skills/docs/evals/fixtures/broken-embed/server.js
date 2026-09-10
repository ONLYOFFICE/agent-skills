const path = require("node:path");
const fs = require("node:fs");
const express = require("express");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const STORAGE = path.join(__dirname, "storage");
const SECRET = process.env.ONLYOFFICE_JWT_SECRET || "my-onlyoffice-secret";
const PUBLIC_URL = process.env.PUBLIC_URL || "http://host.docker.internal:3000";
const DOCS_URL = process.env.DOCS_URL || "http://localhost:8080";

// Everything the page needs to boot the editor.
app.get("/api/session", (req, res) => {
  const file = path.basename(req.query.file || "report.docx");
  res.json({
    file,
    docsUrl: DOCS_URL,
    downloadUrl: `${PUBLIC_URL}/download?file=${encodeURIComponent(file)}`,
    callbackUrl: `${PUBLIC_URL}/track?file=${encodeURIComponent(file)}`,
    secret: SECRET,
    user: { id: "alice@corp.example", name: "Alice Nguyen" },
  });
});

app.get("/files", (_req, res) => {
  res.json(fs.readdirSync(STORAGE));
});

app.get("/download", (req, res) => {
  const file = path.basename(req.query.file);
  res.download(path.join(STORAGE, file), file);
});

app.post("/track", async (req, res) => {
  const body = req.body;

  if (!body.token) {
    return res.status(401).json({ error: 1 });
  }
  try {
    jwt.verify(body.token, SECRET);
  } catch {
    return res.status(401).json({ error: 1 });
  }

  try {
    switch (body.status) {
      case 1:
        console.log(`[track] editing ${body.key} (${(body.users || []).join(", ")})`);
        break;
      case 2:
      case 6: {
        const target = path.join(STORAGE, path.basename(req.query.file));
        const upstream = await fetch(body.url);
        if (!upstream.ok) throw new Error(`download failed: ${upstream.status}`);
        fs.writeFileSync(target, Buffer.from(await upstream.arrayBuffer()));
        console.log(`[track] saved ${target}`);
        break;
      }
      case 3:
      case 7:
        console.error(`[track] save error ${body.status} for ${body.key}`);
        break;
      case 4:
        console.log(`[track] closed with no changes: ${body.key}`);
        break;
      default:
        console.warn(`[track] unhandled status ${body.status}`);
    }
    return res.json({ error: 0 });
  } catch (err) {
    console.error("[track]", err);
    return res.status(500).json({ error: 1 });
  }
});

app.listen(3000, () => console.log("docs-portal on :3000"));
