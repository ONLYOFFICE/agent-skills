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
 * The shapes the host reads at runtime - items, returned messages, the React components they
 * carry - checked against real values from the imported bundle. Deprecated declarative fields
 * are recognised and warned about, not walked.
 */

import {
  ACTION_PAYLOAD,
  DEVICES,
  EVENT_TYPES,
  KNOWN_ACTIONS,
  SECTIONS,
  USER_ROLES,
  USERS_TYPES,
} from "../contract.mjs";
import { Check } from "./findings.mjs";

/** Both role enums' values: the portal matches a UserRole value as well as a UsersType one. */
const ROLE_VALUES = [...new Set([...USERS_TYPES, ...USER_ROLES])];

/** The scopes whose items carry a submenu of the same interface in `items`. */
const SUBMENU_SCOPES = ["ContextMenu", "MainButton"];

/** Actions whose setter belongs to a mounted element: from an item callback they do nothing. */
const ITEM_IGNORED_ACTIONS = ["update-props", "update-context", "update-create-dialog-modal"];

/** `Actions.showModal` is "show-modal": the enum key is the usual mistake. */
const asActionValue = (key) =>
  `${key}`.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/** A function, or a memo/forwardRef object - never a JSX *element* (`component: <Panel />`). */
export const isReactComponent = (value) =>
  typeof value === "function" ||
  (value !== null &&
    typeof value === "object" &&
    "$$typeof" in value &&
    !("props" in value));

const isReactElement = (value) =>
  value !== null &&
  typeof value === "object" &&
  "type" in value &&
  "props" in value;

export class ShapeChecks extends Check {
  /** One registered item, against the contract of the scope that registered it. */
  item(scope, contract, key, item) {
    const where = `${scope} item "${key}"`;

    for (const field of contract.required)
      if (item[field] === undefined)
        this.error("item", `${where} has no ${field}`);

    if (contract.oneOf) this.#checkOneOf(where, contract.oneOf, item);
    if (contract.deprecated) this.#checkDeprecatedFields(where, contract, item);

    if (item.component !== undefined) this.#component(where, item.component);

    this.#checkFilters(where, scope, contract, item);
    this.#checkIcon(where, item);
    this.#checkScopeSpecifics(where, scope, item);

    if (SUBMENU_SCOPES.includes(scope)) this.#checkMenuEntry(where, scope, contract, item);

    // A scope keyed by extension has no room for a prefix.
    if (contract.key === "key") this.#checkKeyIsNamespaced(where, key);
    else if (typeof item.extension === "string" && key !== item.extension)
      this.error(
        "item",
        `${where} is stored under a key other than its extension "${item.extension}" - the portal draws the icon from extension but finds the click by key, so the file shows the plugin's icon and opens as if no plugin owned it; key the map by the extension`,
      );
  }

  #checkFilters(where, scope, contract, entry) {
    this.#checkFilterFieldName(where, scope, contract, entry);

    this.#filterValues(where, contract.filter, entry[contract.filter]);
    this.#filterValues(where, "devices", entry.devices);
  }

  #checkIcon(where, entry) {
    if (
      typeof entry.icon === "string" &&
      !this.project.assetNames.includes(entry.icon)
    )
      this.error("item", `${where} icon "${entry.icon}" is not in assets/`);
  }

  /** A ContextMenu or MainButton entry, parent or child: how it is clicked, and its submenu. */
  #checkMenuEntry(where, scope, contract, entry) {
    this.#checkClickable(where, scope, entry);
    this.#checkDeprecatedClick(where, scope, entry);

    if (entry.items?.some((child) => child?.items?.length))
      this.warn(
        "item",
        scope === "ContextMenu"
          ? `${where} nests deeper than 2 levels - the SDK types leave items off a child, and the portal keeps the children of the first such child only, so the others render as entries that do nothing; keep the submenu one level deep`
          : `${where} nests deeper than 2 levels - the SDK types leave items off a child, and the portal drops a child's items, so it renders as an entry that does nothing; keep the submenu one level deep`,
      );

    this.#checkSubmenu(where, scope, contract, entry.items);
  }

  /**
   * An entry the host can click: a ContextMenu group action through onGroupClick and nothing
   * else, any other entry through onItemClick (or the deprecated onClick), a parent through its
   * children.
   */
  #checkClickable(where, scope, entry) {
    if (scope === "ContextMenu" && entry.isGroupAction) {
      if (!entry.onGroupClick)
        this.error(
          "item",
          `${where} is a group action but has no onGroupClick - the host calls nothing else for a multi-selection`,
        );
      return;
    }

    if (entry.onItemClick || entry.onClick || entry.items) return;

    this.error(
      "item",
      scope === "ContextMenu" && entry.onGroupClick
        ? `${where} has only onGroupClick but is not marked isGroupAction - the host calls onItemClick for a single selection, so the click does nothing`
        : `${where} has neither onItemClick nor nested items - the entry is drawn and does nothing`,
    );
  }

  /** `onClick` still works on these two scopes, as the deprecated spelling of `onItemClick`. */
  #checkDeprecatedClick(where, scope, item) {
    if (item.onClick !== undefined)
      this.warn(
        "deprecated",
        `${where} uses onClick, which SDK 3 deprecates for ${scope} items - name it onItemClick; the portal passes the same argument${item.onItemClick !== undefined ? ", and beside onItemClick it is never called" : ""}`,
      );
  }

  /**
   * A submenu child is an item of the same interface, clicked by the same host code - so it can
   * carry every mistake its parent can. A ContextMenu child is filtered like its parent; a
   * MainButton child is not, its filters are copied in unread, so their values are moot.
   */
  #checkSubmenu(where, scope, contract, children) {
    if (!Array.isArray(children)) return;

    for (const child of children) {
      if (!child || typeof child !== "object") continue;

      const at = `${where} > "${child.key ?? child.label ?? "?"}"`;

      if (scope === "MainButton") this.#warnUnreadFilters(at, child);
      else this.#checkFilters(at, scope, contract, child);

      this.#checkIcon(at, child);
      this.#checkMenuEntry(at, scope, contract, child);
    }
  }

  /** Either spelling: neither is read on a MainButton child. */
  #warnUnreadFilters(where, child) {
    for (const field of ["usersType", "usersTypes", "devices"])
      if (child[field] !== undefined)
        this.warn(
          "item",
          `${where} sets ${field}, which the portal reads on the parent only - the child is shown to everyone its parent is shown to; make it a top-level item to filter it`,
        );
  }

  #checkOneOf(where, alternatives, item) {
    const present = alternatives.filter((field) => item[field] !== undefined);

    if (present.length === 0)
      this.error(
        "item",
        `${where} has neither ${alternatives.join(" nor ")} - the portal has nothing to render for it`,
      );
    else if (present.length > 1)
      this.warn(
        "item",
        `${where} has both ${present.join(" and ")} - the portal renders ${present[0]} and ignores the rest`,
      );
  }

  #checkDeprecatedFields(where, contract, item) {
    for (const field of contract.deprecated)
      if (item[field] !== undefined)
        this.warn(
          "deprecated",
          `${where} uses ${field}, which SDK 3 deprecates - a React component passed as \`component\` replaces it (and loads its own data in a useEffect). The declarative tree is not checked here`,
        );
  }

  #component(where, value) {
    if (isReactComponent(value)) return;

    if (isReactElement(value))
      this.error(
        "item",
        `${where} component is a JSX element (<Something />) - ONLYOFFICE Apps expects the component itself (component: Something), which it renders with the plugin runtime in context`,
      );
    else
      this.error(
        "item",
        `${where} component is ${typeof value}, not a React component - the portal calls it as a function during render`,
      );
  }

  /** The host reads a different field name per scope; the wrong one is skipped in silence. */
  #checkFilterFieldName(where, scope, contract, item) {
    const wrongFilter =
      contract.filter === "usersTypes" ? "usersType" : "usersTypes";

    if (item[wrongFilter] !== undefined)
      this.error(
        "item",
        `${where} uses ${wrongFilter} but the host reads ${contract.filter} for ${scope} - the filter is silently ignored`,
      );
  }

  #checkScopeSpecifics(where, scope, item) {
    if (scope === "EventListener" && !EVENT_TYPES.includes(item.eventType))
      this.error(
        "item",
        `${where} eventType "${item.eventType}" is not a known Events value`,
      );

    if (
      scope === "File" &&
      typeof item.extension === "string" &&
      !item.extension.startsWith(".")
    )
      this.error(
        "item",
        `${where} extension "${item.extension}" has no leading dot - the portal compares it with the file's extension, dot included, so it never owns a file`,
      );

    if (
      scope === "ArticleNavigation" &&
      typeof item.icon === "string" &&
      !item.icon.toLowerCase().endsWith(".svg")
    )
      this.error(
        "item",
        `${where} icon "${item.icon}" is not an SVG - the sidebar inlines the icon as SVG markup, so any other format draws an empty slot`,
      );

    if (scope === "ArticleNavigation" && item.appears !== undefined) {
      if (!Array.isArray(item.appears))
        this.error(
          "item",
          `${where} appears must be an array of Section values`,
        );
      else if (item.appears.length === 0)
        this.error(
          "item",
          `${where} appears is an empty array - the entry is shown in no section at all; leave appears out to show it in every section`,
        );
      else
        for (const section of item.appears)
          if (!SECTIONS.includes(section))
            this.error(
              "item",
              `${where} appears contains "${section}", which is not a Section value (${SECTIONS.join(", ")}) - it matches no section, so the entry is missing from the one it was meant for`,
            );
    }
  }

  /** Item keys share one host-wide map per scope, across every installed plugin. */
  #checkKeyIsNamespaced(where, key) {
    const pluginSlug = this.project.manifest.name;

    if (
      pluginSlug &&
      typeof key === "string" &&
      key !== pluginSlug &&
      !key.startsWith(`${pluginSlug}-`)
    )
      this.warn(
        "item",
        `${where} key is not namespaced - prefix it with "${pluginSlug}-", the manifest's name spelled exactly as it appears there (not pluginName, and not a squashed slug of it). Item keys share one host-wide map per scope, so a generic key collides with another plugin's and one evicts the other`,
      );
  }

  #filterValues(where, field, value) {
    if (value === undefined) return;

    if (!Array.isArray(value)) {
      this.error("item", `${where} ${field} must be an array`);
      return;
    }

    if (value.length === 0) {
      this.error(
        "item",
        `${where} ${field} is an empty array - the host shows the item only to a value the list contains, so it is filtered out for everyone; leave ${field} out to show it to all`,
      );
      return;
    }

    const allowed = field === "devices" ? DEVICES : ROLE_VALUES;

    for (const entry of value)
      if (!allowed.includes(entry))
        this.error(
          "item",
          `${where} ${field} contains "${entry}", which is not a valid value (${allowed.join(", ")}) - the host compares these exactly, so the item is filtered out for everyone`,
        );
  }

  /** The ISettings object the settings aside renders. */
  settings(settings) {
    const where = "the Settings page";

    if (settings.component === undefined && settings.settings === undefined) {
      this.error(
        "item",
        `${where} has neither component nor settings - the settings aside opens on an empty block`,
      );
      return;
    }

    if (settings.component !== undefined)
      this.#component(where, settings.component);

    for (const field of ["settings", "onLoad"])
      if (settings[field] !== undefined)
        this.warn(
          "deprecated",
          `${where} uses ${field}, which SDK 3 deprecates - pass a React component as \`component\`; it loads with usePluginSettings().load() and saves through setSaveButton()`,
        );
  }

  /**
   * An IMessage as an item's callback returned it - a menu click, a file click, an event
   * handler: known actions, their payloads, and the actions such a callback cannot carry.
   */
  message(where, message) {
    if (message === undefined || message === null) return;

    if (!Array.isArray(message.actions)) {
      this.warn(
        "message",
        `${where} returned a message without an actions array`,
      );
      return;
    }

    // The installed SDK is the authority on which action strings exist.
    const validActions = this.project.sdkActions.length
      ? this.project.sdkActions
      : KNOWN_ACTIONS;

    for (const action of message.actions) {
      if (!validActions.includes(action)) {
        const asValue = asActionValue(action);

        this.error(
          "message",
          `${where} returns action "${action}", which is not an Actions value${
            validActions.includes(asValue)
              ? ` - that looks like the enum key; the value is "${asValue}"`
              : ""
          }. The host matches on the string, so it does nothing`,
        );
        continue;
      }

      const payloadField = ACTION_PAYLOAD[action];
      if (payloadField && message[payloadField] === undefined)
        this.error(
          "message",
          `${where} returns action "${action}" without ${payloadField} - the host silently skips it`,
        );

      if (action === "open-info-panel" && message.infoPanelTab === undefined)
        this.warn(
          "message",
          `${where} returns "open-info-panel" without infoPanelTab - the panel opens on no tab, stores an invalid view and loses the user's remembered one; pass the tab (the key of your own info panel item, or "info_details")`,
        );

      if (ITEM_IGNORED_ACTIONS.includes(action))
        this.warn(
          "message",
          `${where} returns "${action}", which the portal ignores from this callback - ${action === "update-create-dialog-modal" ? "it works only from the create dialog's own onSave, onError, onChange and onSelect" : "it works only from an element of an SDK 2 declarative tree"}`,
        );
    }

    if (message.modalDialogProps !== undefined)
      this.#modal(where, message.modalDialogProps);
    if (message.mediaViewerProps !== undefined)
      this.#mediaViewer(where, message.mediaViewerProps);
  }

  /** IModalDialog: a React body via dialogBodyComponent, or the deprecated dialogBody - never neither. */
  #modal(where, modal) {
    if (!modal || typeof modal !== "object") return;

    const hasComponent = modal.dialogBodyComponent !== undefined;
    const hasBody = modal.dialogBody !== undefined;

    if (!hasComponent && !hasBody) {
      this.error(
        "message",
        `${where} opens a modal with neither dialogBodyComponent nor dialogBody - the dialog opens empty`,
      );
      return;
    }

    if (hasComponent) {
      this.#component(`${where} modal`, modal.dialogBodyComponent);

      if (hasBody)
        this.warn(
          "message",
          `${where} opens a modal with both dialogBodyComponent and dialogBody - the component wins and the tree is ignored`,
        );

      if (modal.dialogFooter !== undefined)
        this.warn(
          "deprecated",
          `${where} opens a React modal with a declarative dialogFooter - a React dialog has no footer slot; render the buttons inside dialogBodyComponent`,
        );

      return;
    }

    this.warn(
      "deprecated",
      `${where} opens a modal with a declarative dialogBody, which SDK 3 deprecates - pass a React component as dialogBodyComponent instead. The tree is not checked here`,
    );

    if (typeof modal.onClose !== "function")
      this.error(
        "message",
        `${where} opens a declarative modal without onClose - the close button does nothing`,
      );
  }

  /** IMediaViewer: a React `component`, or the deprecated `content` box. */
  #mediaViewer(where, viewer) {
    if (!viewer || typeof viewer !== "object") return;

    if (viewer.component === undefined && viewer.content === undefined) {
      this.error(
        "message",
        `${where} opens the media viewer with neither component nor content - the portal shows the file itself if it is an image or a video, and a bare header otherwise`,
      );
      return;
    }

    if (viewer.component !== undefined)
      this.#component(`${where} media viewer`, viewer.component);
    else
      this.warn(
        "deprecated",
        `${where} opens the media viewer with a declarative content box, which SDK 3 deprecates - pass a React component as \`component\`; it reads the file with useCurrentFile()`,
      );
  }
}
