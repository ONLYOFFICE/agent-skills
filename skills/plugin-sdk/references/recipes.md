# Recipes

Working patterns for the things plugins actually do. Each one is shaped by a host constraint explained in [host-behavior.md](host-behavior.md) — the comments say which.

## A modal with live validation

The most common shape, and the one that exercises the trickiest rule: a menu item cannot update anything itself, so it opens a modal, and updates happen from inside the modal's own elements.

```ts
let draft = "";

const errorText = (text: string) => ({
  actions: [Actions.updateContext],
  contextProps: [{ name: "url-error", props: { text } }],
});

const dialogBody = (): IBox => ({
  displayProp: "flex",
  flexDirection: "column",
  children: [
    {
      component: Components.input,
      contextName: "url-input",
      props: {
        value: draft,
        placeholder: "https://",
        scale: true,
        // Self-update keeps the field editable; the sibling update shows the error.
        // Both only work because this callback lives inside the rendered tree.
        onChange: (value: string) => {
          draft = value;
          const invalid = value.length > 0 && !/^https?:\/\//.test(value);

          return {
            actions: [Actions.updateProps, Actions.updateContext],
            newProps: { value, hasError: invalid },
            contextProps: [
              { name: "url-error", props: { text: invalid ? t("dialog.invalidUrl") : "" } },
            ],
          };
        },
      },
    },
    {
      component: Components.text,
      contextName: "url-error",
      // --input-error-color is the real token; --error-color does not exist on the portal.
      props: { text: "", color: "var(--input-error-color)", fontSize: "12px" },
    },
  ],
});

// Portal footer convention: one row, primary action first, both scaled,
// an 8px spacer box between them.
const dialogFooter = (): IBox => ({
  displayProp: "flex",
  children: [
    {
      component: Components.button,
      props: {
        label: t("dialog.save"),
        size: ButtonSize.normal,
        primary: true,
        scale: true,
        // The host runs the spinner and blocks double-clicks for us.
        withLoadingAfterClick: true,
        disableWhileRequestRunning: true,
        onClick: async () => {
          if (!/^https?:\/\//.test(draft)) return errorText(t("dialog.invalidUrl"));

          try {
            await saveSomewhere(draft);
            return {
              actions: [Actions.closeModal, Actions.showToast],
              toastProps: [{ type: ToastType.success, title: t("toast.saved") }],
            };
          } catch {
            // Nothing catches this for us - an uncaught rejection is a dead button.
            return errorText(t("dialog.saveFailed"));
          }
        },
      },
    },
    { component: Components.box, props: { widthProp: "8px" } },
    {
      component: Components.button,
      props: {
        label: t("dialog.cancel"),
        size: ButtonSize.normal,
        scale: true,
        onClick: () => ({ actions: [Actions.closeModal] }),
      },
    },
  ],
});

export const urlDialog = (): IModalDialog => ({
  displayType: ModalDisplayType.modal,
  dialogHeader: t("dialog.header"),
  dialogBody: dialogBody(),
  dialogFooter: dialogFooter(),
  autoMaxHeight: true,   // a bare modal caps at 280px and does not scroll
  onClose: () => ({ actions: [Actions.closeModal] }),
  // onLoad is mandatory - and it REPLACES header, body and footer together.
  // Returning only newDialogBody would wipe the header and footer.
  onLoad: async () => ({
    newDialogHeader: t("dialog.header"),
    newDialogBody: dialogBody(),
    newDialogFooter: dialogFooter(),
  }),
});
```

Opening it from a context menu:

```ts
onItemClick: async (id) => {
  currentId = id;
  return { actions: [Actions.showModal], modalDialogProps: urlDialog() };
},
```

## Admin settings that persist

Settings travel as one opaque string. The plugin owns the format; the portal only stores it.

```ts
type TSettings = { apiKey: string; enabled: boolean };

let settings: TSettings = { apiKey: "", enabled: true };

const settingsBody = (): IBox => ({
  displayProp: "flex",
  flexDirection: "column",
  children: [
    {
      component: Components.input,
      props: {
        value: settings.apiKey,
        scale: true,
        onChange: (value: string) => {
          settings = { ...settings, apiKey: value };
          return { actions: [Actions.updateProps], newProps: { value } };
        },
      },
    },
  ],
});

export const pluginSettings = (): ISettings => ({
  settings: settingsBody(),
  saveButton: {
    component: Components.button,
    // The host renders this in the settings aside's footer and FORCES its look:
    // label becomes the portal's localized "Save", size normal, primary, scaled.
    // Only onClick and the loading flags below are really yours.
    props: {
      label: t("settings.save"),
      size: ButtonSize.normal,
      primary: true,
      withLoadingAfterClick: true,
      disableWhileRequestRunning: true,
      // saveSettings works from buttons and menu callbacks, but this button is
      // where users expect persistence - and from a non-button element it throws.
      onClick: async () => ({
        actions: [Actions.saveSettings, Actions.showToast],
        settings: JSON.stringify(settings),
        toastProps: [{ type: ToastType.success, title: t("settings.saved") }],
      }),
    },
  },
  onLoad: async () => ({ settings: settingsBody() }),
});
```

Reading them back — this arrives **after** installation, never during `onLoadCallback`:

```ts
setAdminPluginSettingsValue = (value: string | null): void => {
  if (!value) return;

  try {
    settings = { ...settings, ...(JSON.parse(value) as TSettings) };
  } catch {
    // Keep the defaults rather than breaking installation on a bad stored value.
  }
};
```

## Acting on a file, with permissions respected

```ts
const onFileAction = async (id: number) => {
  try {
    const res = await fetch(`${buildApiUrl()}/files/file/${id}`, { credentials: "include" });
    const file = (await res.json()).response;      // note the wrapper

    if (!file.security?.Download)
      return {
        actions: [Actions.showToast],
        toastProps: [{ type: ToastType.error, title: t("toast.noPermission") }],
      };

    const content = await (await fetch(file.viewUrl)).text();   // bytes come from viewUrl

    return {
      actions: [Actions.showModal],
      modalDialogProps: previewDialog(file.title, content),
    };
  } catch {
    return {
      actions: [Actions.showToast],
      toastProps: [{ type: ToastType.error, title: t("toast.readFailed") }],
    };
  }
};
```

## A panel that loads asynchronously

Fetching in `onLoadCallback` delays the whole plugin's installation, and an exception there aborts it silently. Put the work in the item's `onLoad` instead and show a skeleton meanwhile.

```ts
const loadingBody = (): IBox => ({
  children: [{ component: Components.skeleton, props: { width: "100%", height: "80px" } }],
});

const loadedBody = (rows: string[]): IBox => ({
  displayProp: "flex",
  flexDirection: "column",
  children: rows.map((text) => ({ component: Components.text, props: { text } })),
});

export const reportItem = (): IInfoPanelItem => ({
  key: "myplugin-report",
  subMenu: { name: t("infoPanel.tab") },
  body: loadingBody(),
  onLoad: async () => {
    try {
      return { body: loadedBody(await fetchRows()) };
    } catch {
      return { body: loadedBody([t("infoPanel.failed")]) };
    }
  },
});
```

## Reacting to a portal event

Handlers are subscribed as plain `window` listeners and receive **no arguments** — see [items.md](items.md#eventlistener).

```ts
export const createListener = (): IEventListenerItem => ({
  key: "myplugin-on-create",
  eventType: Events.CREATE,
  // No arguments are passed - the handler learns "something was created",
  // not what. Fetch if it needs details.
  eventHandler: async () => ({
    actions: [Actions.showToast],
    toastProps: [{ type: ToastType.info, title: t("toast.created") }],
  }),
});
```

## Embedding a third-party page

For an external editor or viewer. The plugin runs in a hidden iframe, so the listener goes on `window.parent`, and the origin must be in `cspDomains`.

```ts
const embedBody = (): IBox => ({
  children: [
    {
      component: Components.iFrame,
      props: { id: "myplugin-frame", src: "https://example.com/editor", width: "100%", height: "600px" },
    },
  ],
});

// Set this up once, in onLoadCallback.
const listenToFrame = () => {
  window.parent.addEventListener("message", (event: MessageEvent) => {
    if (event.origin !== "https://example.com") return;   // always check the origin

    const data = JSON.parse(event.data);

    // The portal gave us this callback; calling it asks the portal to act.
    plugin.postMessageCallback({
      actions: [Actions.showToast],
      toastProps: [{ type: ToastType.success, title: data.title }],
    });
  });
};
```

Sending a message the other way uses the portal, addressing the frame by DOM id:

```ts
{ actions: [Actions.sendPostMessage], postMessage: { frameId: "myplugin-frame", message: { command: "save" } } }
```
