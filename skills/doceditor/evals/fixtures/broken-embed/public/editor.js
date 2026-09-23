function buildConfig(session) {
  return {
    documentType: "text",
    document: {
      fileType: session.file.split(".").pop(),
      key: session.file,
      title: session.file,
      url: session.downloadUrl,
    },
    callbackUrl: session.callbackUrl,
    lang: "en",
    user: session.user,
    onDocumentReady: function () {
      console.log("editor ready");
    },
    onDocumentStateChange: function (event) {
      console.log("unsaved changes:", event.data);
    },
  };
}

function sign(config, secret) {
  const header = JSON.stringify({ alg: "HS256", typ: "JWT" });
  return KJUR.jws.JWS.sign("HS256", header, JSON.stringify(config), secret);
}

async function loadSession(file) {
  const response = await fetch("/api/session?file=" + encodeURIComponent(file));
  return response.json();
}

async function open(file) {
  const session = await loadSession(file);

  if (!window.DocsAPI) {
    await new Promise((resolve) => {
      const tag = document.createElement("script");
      tag.src = session.docsUrl + "/web-apps/apps/api/documents/api.js";
      tag.onload = resolve;
      document.head.appendChild(tag);
    });
  }

  const config = buildConfig(session);
  config.token = sign(config, session.secret);

  window.docEditor = new DocsAPI.DocEditor("placeholder", config);
  document.getElementById("placeholder").style.height = window.innerHeight - 48 + "px";
}

async function boot() {
  const picker = document.getElementById("file-picker");
  const files = await fetch("/files").then((r) => r.json());
  for (const file of files) {
    picker.add(new Option(file, file));
  }
  picker.onchange = () => open(picker.value);

  const requested = new URLSearchParams(location.search).get("file") || files[0];
  picker.value = requested;
  open(requested);
}

boot();
