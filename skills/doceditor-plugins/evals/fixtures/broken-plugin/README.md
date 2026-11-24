# Ticket helper

An ONLYOFFICE Docs plugin for the document editor. Right-click selected text -> "Make ticket link" turns it into `TCK-<text>`; the right-hand panel shows the selected text and how many ticket links the document has; a toolbar tab "Tickets" has a "Settings" button that opens `settings.html`; each paragraph with a ticket is marked with an annotation.

Notes from the team:

- In our checkout of the marketplace repo it loads. Installed from the zip on the staging server it is just blank.
- On the customer's 8.0 servers there is no panel at all.
- "Make ticket link" shows in the menu but clicking it does nothing. Ivan added the `attachEditorEvent("onContextMenuClick")` line to "register the click", no change.
- Right-clicking with nothing selected, the menu takes a second or two to open.
- The link text comes out as `undefined<text>`.
- The ticket count in the panel sometimes shows the inserted paragraph's text instead of a number.
- "Tickets" never appears on the toolbar; there is an error in the editor console when the plugin starts.
- Clearing the selection leaves the old text in the panel.
- Annotations work on our test server, nothing at the customer.
- The settings window works fine.
