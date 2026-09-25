# Hooks

All from `@onlyoffice/docspace-plugin-sdk/react`. They read a context the portal provides around the component, so they **throw outside one** — at module scope, in a class-side callback (`onItemClick`, `onClick`, `eventHandler`), in `onLoadCallback`.

| Hook | Returns |
|---|---|
| `useCurrentFile()` | `TCurrentFile \| null` — `{ id, title, fileExst?, isFolder?, isRoom?, roomType? }`; `fileExst` keeps the dot |
| `useCurrentUser()` | `TCurrentUser \| null` — `{ id, displayName, email, isOwner, isAdmin, isRoomAdmin }`; `null` while the profile loads |
| `usePluginActions()` | the [actions](actions.md) object |
| `usePluginAPI()` | the [API client](api.md) |
| `usePluginSettings()` | the [settings client](../plugins/settings-plugin.md#the-settings-client) |
| `usePluginRuntime()` | all of the above as `{ currentFile, currentUser, actions, api, settings }` |

The runtime object is rebuilt only when the current file or user changes, so `api`, `actions` and `settings` are stable in effect dependencies.

## What `useCurrentFile` returns where

| Component rendered as | `useCurrentFile()` |
|---|---|
| Info panel tab | the selected file/folder/room, live |
| Media viewer | the file on screen — the one passed as `fileId`, then each file the user pages to ([media-viewer.md](../components/media-viewer.md)) |
| Modal opened from **another component** via `showModal` | that component's current file |
| Modal opened from a **class-side callback** (context menu, main button, file click, event) | **`null`** — the message carries no selection |
| Sidebar page, sidebar button, settings page | `null` |

So a menu action that opens a modal about the clicked file hands the id over itself — a module variable or a factory closing over it:

```ts
let targetId: string | number | null = null;

const item: IContextMenuItem = {
  key: "my-plugin-details", label: t("details"), icon: "icon-16.svg",
  onItemClick: (id) => {
    targetId = id;
    return { actions: [Actions.showModal], modalDialogProps: { dialogHeader: t("details"), dialogBodyComponent: DetailsModal } };
  },
};

function DetailsModal() {
  const api = usePluginAPI();   // read targetId here, e.g. api.get(`/files/file/${targetId}`)
}
```
