// converter.js — ingest pipeline's conversion worker.
// Converts an uploaded file to PDF via the ONLYOFFICE Conversion API before indexing.

const jwt = require("jsonwebtoken");

const DOCUMENT_SERVER = process.env.DOCUMENT_SERVER_URL; // e.g. https://docs.ourcompany.internal
const JWT_SECRET = process.env.CONVERTER_JWT_SECRET;

// Formats this worker knows how to send through the converter. Update this
// list when a new source format gets support.
const SUPPORTED_FORMATS = ["doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "html"];

function isSupported(filetype) {
  return SUPPORTED_FORMATS.includes(filetype.toLowerCase());
}

async function requestConversion(filetype, outputtype, key, url) {
  const claims = {
    async: true,
    filetype: filetype.toLowerCase(),
    outputtype: outputtype.toLowerCase(),
    key,
    url,
  };
  const token = jwt.sign(claims, JWT_SECRET, { algorithm: "HS256" });

  const response = await fetch(`${DOCUMENT_SERVER}/converter`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(claims),
  });

  return response.json();
}

async function pollUntilDone(filetype, outputtype, url, onProgress) {
  while (true) {
    // A fresh key per attempt so the service never confuses one poll for another.
    const pollKey = `poll-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const result = await requestConversion(filetype, outputtype, pollKey, url);
    // Drives the progress bar on the upload page.
    onProgress(result.percent || 0);

    if (result.endConvert) {
      return result.fileUrl;
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

async function convertDocument(filetype, outputtype, url, onProgress = () => {}) {
  if (!isSupported(filetype)) {
    return null;
  }

  try {
    return await pollUntilDone(filetype, outputtype, url, onProgress);
  } catch (err) {
    console.error("conversion failed");
    throw new Error("conversion failed");
  }
}

module.exports = { convertDocument };
