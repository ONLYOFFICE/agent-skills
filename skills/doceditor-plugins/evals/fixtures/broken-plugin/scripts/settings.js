(function (window) {
  // The settings window: its own page with its own plugins.js. It talks to the plugin only through
  // messages - sendToPlugin out, attachEvent in - and loads the runtime from its absolute URL.
  window.Asc.plugin.init = function () {
    window.Asc.plugin.sendToPlugin("onWindowReady", {});
  };

  window.Asc.plugin.attachEvent("onSettings", function (settings) {
    document.getElementById("project").value = settings.project;
  });

  document.getElementById("save").onclick = function () {
    window.Asc.plugin.sendToPlugin("onSaveSettings", { project: document.getElementById("project").value });
  };

  window.Asc.plugin.button = function () {};
})(window);
