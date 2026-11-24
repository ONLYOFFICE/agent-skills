(function (window) {
  const PREFIX = "TCK-";

  function showCount() {
    window.Asc.plugin.callCommand(function () {
      return Api.GetDocument().Search("TCK-").length;
    }, false, false, function (count) {
      document.getElementById("count").textContent = count;
    });
  }

  function makeTicketLink(text) {
    window.Asc.plugin.callCommand(function () {
      const paragraph = Api.CreateParagraph();
      paragraph.AddText(PREFIX + Asc.scope.text);
      Api.GetDocument().InsertContent([paragraph]);
      return paragraph;
    }, false, true, function (paragraph) {
      console.log("inserted", paragraph.GetText());
    });
    Asc.scope.text = text;
    showCount();
  }

  window.Asc.plugin.init = function (text) {
    document.getElementById("selection").textContent = text;
    showCount();

    window.Asc.plugin.executeMethod("AddToolbarMenuItem", [[{
      guid: window.Asc.plugin.guid,
      tabs: [{ id: "tickets", text: "Tickets", items: [{ id: "settings", type: "button", text: "Settings", hint: "Ticket settings" }] }]
    }]]);

    window.Asc.plugin.executeMethod("AnnotateParagraph", [{ type: "highlight", name: "tickets", paragraphId: "", recalcId: "", ranges: [] }]);
  };

  window.Asc.plugin.attachEvent("onContextMenuShow", function (options) {
    if (options.type !== "Selection") return;
    window.Asc.plugin.executeMethod("AddContextMenuItem", [{
      guid: window.Asc.plugin.guid,
      items: [{ id: "makeTicket", text: "Make ticket link" }]
    }]);
  });

  window.Asc.plugin.attachContextMenuClickEvent("makeTicket", function () {
    window.Asc.plugin.executeMethod("GetSelectedText", [], makeTicketLink);
  });

  // Register the click with the editor.
  window.Asc.plugin.attachEditorEvent("onContextMenuClick", function () {});

  let project = "TCK";
  window.Asc.plugin.attachToolbarMenuClickEvent("settings", function () {
    const win = new window.Asc.PluginWindow();
    win.attachEvent("onWindowReady", function () {
      win.command("onSettings", { project: project });
    });
    win.attachEvent("onSaveSettings", function (settings) {
      project = settings.project;
      win.close();
    });
    win.show({ url: "settings.html", description: "Ticket settings", isModal: true, EditorsSupport: ["word"], size: [320, 160], buttons: [] });
  });

  window.Asc.plugin.button = function () {
    window.Asc.plugin.executeCommand("close", "");
  };
})(window);
