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
 * against, which payload every action needs. Deliberately *not* derived from the SDK -
 * that says what compiles, this says what a released portal runs. See sdk-target.md.
 */

export const SDK_PACKAGE = "@onlyoffice/docspace-plugin-sdk";

/** The major version this contract was written against. */
export const SDK_MAJOR = 2;

export const SCOPES = [
  "API",
  "Settings",
  "ContextMenu",
  "InfoPanel",
  "MainButton",
  "ProfileMenu",
  "EventListener",
  "File",
  "PostMessage",
  "ArticleButton",
];

/**
 * Per scope: the interface to implement, the members the loader calls, the item shape it
 * reads, and the action that makes it re-read the map. `refresh` is null for ArticleButton -
 * there is no updateArticleButtonItems, so an item registered after installation never arrives.
 */
export const SCOPE_CONTRACT = {
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
    required: ["key", "subMenu", "body"],
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
    // The only scope with no updater in the SDK - re-adding overwrites by key.
    updater: null,
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
    // Keyed by extension, so two plugins claiming ".md" evict one another.
    key: "extension",
    required: ["extension", "onClick"],
    filter: "usersType",
  },
  ArticleButton: {
    iface: "IArticleButtonPlugin",
    item: "IArticleButtonItem",
    field: "articleButtonItems",
    getter: "getArticleButtonItems",
    adder: "addArticleButtonItem",
    updater: "updateArticleButtonItem",
    refresh: null,
    key: "key",
    required: ["key", "body"],
    filter: "usersTypes",
  },
  API: { iface: "IApiPlugin", members: ["setAPI", "getAPI"] },
  Settings: {
    iface: "ISettingsPlugin",
    members: ["setAdminPluginSettingsValue", "getAdminPluginSettings"],
  },
  PostMessage: { iface: "IPostMessagePlugin", members: ["setPostMessageCallback"] },
};

/**
 * Limits the server enforces on an upload. Exceeding one rejects the archive outright
 * rather than failing quietly; references/host-behavior.md has the full list.
 */
export const PORTAL_LIMITS = {
  /** Archive size, and each extracted entry. */
  maxFileBytes: 5 * 1024 * 1024,
  maxAssets: 10,
  assetExtensions: [".svg", ".png", ".jpg", ".jpeg"],
};

/** UsersType values. The enum keys are camelCase; the host compares the values. */
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

/** Actions the host performs with nothing else in the message. */
export const PAYLOAD_FREE_ACTIONS = [
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
];

/**
 * Props each component cannot render without. Nothing wraps the plugin's tree in an error
 * boundary, so a missing one throws during render and blanks the whole portal.
 */
export const COMPONENT_PROPS = {
  box: [],
  button: ["label", "size", "onClick"],
  checkbox: ["isChecked", "onChange"],
  comboBox: ["options", "selectedOption"],
  iFrame: ["src"],
  iconButton: [],
  img: ["src", "alt"],
  input: ["value", "onChange"],
  label: ["text"],
  link: [],
  skeleton: ["width", "height"],
  text: ["text"],
  textArea: ["value", "onChange"],
  toggleButton: ["isChecked", "onChange"],
};

/**
 * Enum values the host's stylesheet actually implements - the SDK compiles more
 * (ButtonSize.extraSmall, InputSize.big/huge). A miss collapses the control.
 */
export const RENDERED_BUTTON_SIZES = ["small", "normal", "medium"];
export const RENDERED_INPUT_SIZES = ["base", "middle", "large"];

/** Every action string this contract knows about. */
export const KNOWN_ACTIONS = [...Object.keys(ACTION_PAYLOAD), ...PAYLOAD_FREE_ACTIONS];

/**
 * Compares the tables above against the SDK the project installed. A mismatch is not the
 * plugin's fault, so all of it is a warning: this tool's contract has aged. Returns
 * {code, message} pairs.
 */
export const checkSdkDrift = (sdk, installedVersion) => {
  const drift = [];
  const note = (message) => drift.push({ code: "sdk-drift", message });

  // An older SDK misses most of the list, and printing all of it buries the one line
  // that matters.
  const summarise = (values) =>
    values.length > 5 ? `${values.slice(0, 5).join(", ")} and ${values.length - 5} more` : values.join(", ");

  const compare = (label, ours, theirs, hint) => {
    if (!Array.isArray(theirs) || theirs.length === 0) return;

    const added = theirs.filter((v) => !ours.includes(v));
    const gone = ours.filter((v) => !theirs.includes(v));

    if (added.length)
      note(
        `the installed SDK has ${label} this tool does not know: ${summarise(added)}${hint ?? ""}`,
      );
    if (gone.length)
      note(`this tool expects ${label} the installed SDK does not have: ${summarise(gone)}`);
  };

  const major = Number(String(installedVersion ?? "").split(".")[0]);
  if (Number.isInteger(major) && major !== SDK_MAJOR)
    note(
      `the project installed ${SDK_PACKAGE} ${installedVersion}, but this tool encodes the portal contract for ${SDK_MAJOR}.x - a scope or action the SDK adds ahead of the portal compiles and then does nothing (see references/sdk-target.md)`,
    );

  const values = (enumObject) => (enumObject ? Object.values(enumObject) : []);

  compare("UsersType values", USERS_TYPES, values(sdk.UsersType));
  compare("Devices values", DEVICES, values(sdk.Devices));
  compare("Events values", EVENT_TYPES, values(sdk.Events));
  compare("components", Object.keys(COMPONENT_PROPS), values(sdk.Components));
  compare(
    "actions",
    KNOWN_ACTIONS,
    values(sdk.Actions),
    " - a returned message using one of those is not checked for its payload",
  );

  return drift;
};
