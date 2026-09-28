// Generates a PDF invoice per order through the ONLYOFFICE Document Builder API.
// Called by the billing queue worker once per paid order.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const DOCS_URL = process.env.DOCS_URL; // e.g. https://docs.example.com
const DOCS_SECRET = process.env.DOCS_JWT_SECRET;
const PUBLIC_BASE = process.env.PUBLIC_BASE_URL; // where this app serves /generated/*
const GENERATED_DIR = path.join(__dirname, "public", "generated");

const TEMPLATE = fs.readFileSync(path.join(__dirname, "scripts", "invoice.template.js"), "utf8");

function sign(payload) {
  return jwt.sign(payload, DOCS_SECRET, { algorithm: "HS256" });
}

async function post(body) {
  const res = await fetch(`${DOCS_URL}/docbuilder`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ token: sign(body) }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Fill the template with this order's data and publish it where the Document Server can fetch it.
function writeScript(order) {
  const rows = order.lines
    .map((l) => `addLine(oDocument, "${l.description}", "${l.qty}", "${l.price}");`)
    .join("\n");
  const source = TEMPLATE
    .replace("{{CUSTOMER}}", order.customerName)
    .replace("{{ORDER_ID}}", order.id)
    .replace("{{ROWS}}", rows);
  const name = `invoice-${order.id}-${crypto.randomBytes(4).toString("hex")}.js`;
  fs.writeFileSync(path.join(GENERATED_DIR, name), source);
  return `${PUBLIC_BASE}/generated/${name}`;
}

async function generateInvoice(order, onProgress = () => {}) {
  const scriptUrl = writeScript(order);

  let percent = 0;
  const ticker = setInterval(() => {
    percent = Math.min(99, percent + 7);
    onProgress(percent);
  }, 1000);

  try {
    let result = await post({ async: true, url: scriptUrl });
    const key = result.key;

    while (!result.end) {
      await new Promise((r) => setTimeout(r, 2000));
      result = await post({ async: true, key });
    }

    onProgress(100);
    // Stored on the order and put in the "your invoice is ready" email.
    return result.urls["invoice.pdf"];
  } catch (e) {
    console.error(`invoice ${order.id}: generation failed`);
    return null;
  } finally {
    clearInterval(ticker);
  }
}

module.exports = { generateInvoice };
