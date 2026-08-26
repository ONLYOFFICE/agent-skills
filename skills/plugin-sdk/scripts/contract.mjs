/*
 * (c) Copyright Ascensio System SIA 2026
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/*
 * The portal contract: what the loader calls on each scope, which values it compares
 * against, which payload every action needs, which packages the host supplies to a
 * module plugin. Deliberately *not* derived from the SDK - that says what compiles,
 * this says what a released portal runs. See references/scopes.md.
 */

export const SDK_PACKAGE = "@onlyoffice/docspace-plugin-sdk";
export const UI_KIT_PACKAGE = "@docspace/ui-kit";

const SDK_REACT_ENTRY = `${SDK_PACKAGE}/react`;
const SDK_MAJOR = 3;

/** The `runtime` value that makes the portal `import()` the bundle and read its default export. */
export const MODULE_RUNTIME = "module";

/**
 * Bare specifiers the host rewrites to its own copies. Everything else must be bundled.
 * The SDK root is absent on purpose: enums and types, no module state.
 */
export const HOST_PROVIDED_SPECIFIERS = [
  "react",
  "react-dom",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  SDK_REACT_ENTRY,
  UI_KIT_PACKAGE,
];

/** What a plugin build must list as `external` - the dev runtime only exists in dev builds. */
export const REQUIRED_EXTERNALS = HOST_PROVIDED_SPECIFIERS.filter((s) => s !== "react/jsx-dev-runtime");

/**
 * Per scope: the interface, the members the loader calls, the item shape it reads, and the
 * action that makes it re-read the map. `required` are fields an item cannot do without;
 * `oneOf` alternatives of which exactly one must be present; `deprecated` fields the SDK
 * still accepts. Order here is the order scopes are listed in messages.
 */
export const SCOPE_CONTRACT = {
  API: { iface: "IApiPlugin", members: ["setAPI", "getAPI"] },
  Settings: {
    iface: "ISettingsPlugin",
    members: ["setAdminPluginSettingsValue", "getAdminPluginSettings"],
  },
  ContextMenu: {
    iface: "IContextMenuPlugin",
    item: "IContextMenuItem",
    field: "contextMenuItems",
    getter: "getContextMenuItems",
    adder: "addContextMenuItem",
    updater: "updateContextMenuItem",
    refresh: "updateContextMenuItems",
    key: "key",
    required: ["key", "label", "icon"],
    filter: "usersTypes",
  },
  InfoPanel: {
    iface: "IInfoPanelPlugin",
    item: "IInfoPanelItem",
    field: "infoPanelItems",
    getter: "getInfoPanelItems",
    adder: "addInfoPanelItem",
    updater: "updateInfoPanelItem",
    refresh: "updateInfoPanelItems",
    key: "key",
    required: ["key", "subMenu"],
    oneOf: ["component", "body"],
    deprecated: ["body", "onLoad"],
    filter: "usersTypes",
  },
  MainButton: {
    iface: "IMainButtonPlugin",
    item: "IMainButtonItem",
    field: "mainButtonItems",
    getter: "getMainButtonItems",
    adder: "addMainButtonItem",
    updater: "updateMainButtonItem",
    refresh: "updateMainButtonItems",
    key: "key",
    required: ["key", "label", "icon"],
    filter: "usersType",
  },
  ProfileMenu: {
    iface: "IProfileMenuPlugin",
    item: "IProfileMenuItem",
    field: "profileMenuItems",
    getter: "getProfileMenuItems",
    adder: "addProfileMenuItem",
    updater: "updateProfileMenuItem",
    refresh: "updateProfileMenuItems",
    key: "key",
    required: ["key", "label", "icon", "onClick"],
    filter: "usersType",
  },
  EventListener: {
    iface: "IEventListenerPlugin",
    item: "IEventListenerItem",
    field: "eventListenerItems",
    getter: "getEventListenerItems",
    adder: "addEventListenerItem",
    updater: null, // the SDK has none - re-adding overwrites by key
    refresh: "updateEventListenerItems",
    key: "key",
    required: ["key", "eventType", "eventHandler"],
    filter: "usersTypes",
  },
  File: {
    iface: "IFilePlugin",
    item: "IFileItem",
    field: "fileItems",
    getter: "getFileItems",
    adder: "addFileItem",
    updater: "updateFileItem",
    refresh: "updateFileItems",
    key: "extension",
    required: ["extension", "onClick"],
    filter: "usersType",
  },
  PostMessage: { iface: "IPostMessagePlugin", members: ["setPostMessageCallback"] },
  ArticleButton: {
    iface: "IArticleButtonPlugin",
    item: "IArticleButtonItem",
    field: "articleButtonItems",
    getter: "getArticleButtonItems",
    adder: "addArticleButtonItem",
    updater: "updateArticleButtonItem",
    refresh: "updateArticleButtonItems",
    key: "key",
    required: ["key"],
    oneOf: ["component", "body"],
    deprecated: ["body", "onLoad"],
    filter: "usersTypes",
  },
  ArticleNavigation: {
    iface: "IArticleNavigationPlugin",
    item: "IArticleNavigationItem",
    field: "articleNavigationItems",
    getter: "getArticleNavigationItems",
    adder: "addArticleNavigationItem",
    updater: "updateArticleNavigationItem",
    refresh: "updateArticleNavigationItems",
    key: "key",
    required: ["key", "label", "icon", "component"],
    filter: "usersTypes",
  },
};

export const SCOPES = Object.keys(SCOPE_CONTRACT);

/** The sections an ArticleNavigation item may be pinned to with `appears`. */
export const SECTIONS = ["Files", "Accounts", "Settings"];

/** Limits the server enforces on an upload; exceeding one rejects the archive. */
export const PORTAL_LIMITS = {
  maxFileBytes: 5 * 1024 * 1024,
  maxFileLabel: "5 MB",
  maxAssets: 10,
  assetExtensions: [".svg", ".png", ".jpg", ".jpeg"],
};

export const megabytes = (bytes) => (bytes / 1e6).toFixed(1);

/** UsersType values - the enum keys are camelCase, the host compares the values. */
export const USERS_TYPES = ["Owner", "DocSpaceAdmin", "RoomAdmin", "Collaborator", "User"];

export const DEVICES = ["mobile", "tablet", "desktop"];

export const EVENT_TYPES = [
  "create",
  "rename",
  "create_room",
  "edit_room",
  "change_column",
  "change_user_type",
  "create_plugin_file",
];

/** Actions that are a no-op unless their payload field is present in the message. */
export const ACTION_PAYLOAD = {
  "update-props": "newProps",
  "update-context": "contextProps",
  "show-toast": "toastProps",
  "show-modal": "modalDialogProps",
  "show-create-dialog-modal": "createDialogProps",
  "update-create-dialog-modal": "createDialogProps",
  "show-selector": "selectorProps",
  "update-selector": "selectorProps",
  "show-media-viewer": "mediaViewerProps",
  "update-media-viewer": "mediaViewerProps",
  "add-floating-operations-button": "floatingOperationsButtonProps",
  "update-floating-operations-button": "floatingOperationsButtonProps",
  "remove-floating-operations-button": "floatingOperationsButtonPropsId",
  "send-post-message": "postMessage",
  "save-settings": "settings",
  navigate: "navigatePath",
};

const PAYLOAD_FREE_ACTIONS = [
  "update-status",
  "close-modal",
  "close-selector",
  "close-media-viewer",
  "open-info-panel",
  "update-context-menu-items",
  "update-info-panel-items",
  "update-main-button-items",
  "update-profile-menu-items",
  "update-file-items",
  "update-event-listener-items",
  "update-article-button-items",
  "update-article-navigation-items",
];

export const KNOWN_ACTIONS = [...Object.keys(ACTION_PAYLOAD), ...PAYLOAD_FREE_ACTIONS];

/**
 * Compares the tables above against the SDK the project installed. A mismatch is this
 * tool's contract having aged, not the plugin's fault. Returns warning messages.
 */
export const checkSdkDrift = (sdk, installedVersion) => {
  const drift = [];

  const summarise = (values) =>
    values.length > 5 ? `${values.slice(0, 5).join(", ")} and ${values.length - 5} more` : values.join(", ");

  const compare = (label, ours, theirs, hint) => {
    if (!Array.isArray(theirs) || theirs.length === 0) return;

    const added = theirs.filter((v) => !ours.includes(v));
    const gone = ours.filter((v) => !theirs.includes(v));

    if (added.length)
      drift.push(`the installed SDK has ${label} this tool does not know: ${summarise(added)}${hint ?? ""}`);
    if (gone.length)
      drift.push(`this tool expects ${label} the installed SDK does not have: ${summarise(gone)}`);
  };

  const major = Number(String(installedVersion ?? "").split(".")[0]);
  if (Number.isInteger(major) && major !== SDK_MAJOR)
    drift.push(
      major < SDK_MAJOR
        ? `the project installed ${SDK_PACKAGE} ${installedVersion}, but this tool encodes the portal contract for ${SDK_MAJOR}.x - that SDK has no React entry, no "component" props and no ArticleNavigation scope, so the plugin is limited to the deprecated declarative trees (see references/scopes.md)`
        : `the project installed ${SDK_PACKAGE} ${installedVersion}, but this tool encodes the portal contract for ${SDK_MAJOR}.x - a scope or action the SDK adds ahead of the portal compiles and then does nothing (see references/scopes.md)`,
    );

  const values = (enumObject) => (enumObject ? Object.values(enumObject) : []);

  compare("UsersType values", USERS_TYPES, values(sdk.UsersType));
  compare("Devices values", DEVICES, values(sdk.Devices));
  compare("Events values", EVENT_TYPES, values(sdk.Events));
  compare("Section values", SECTIONS, values(sdk.Section));
  compare(
    "actions",
    KNOWN_ACTIONS,
    values(sdk.Actions),
    " - a returned message using one of those is not checked for its payload",
  );

  return drift;
};
