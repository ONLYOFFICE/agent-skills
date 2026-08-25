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
 * The shapes the host reads at runtime - items, returned messages, component trees - all
 * checked against real values from the sandbox, in one class because a modal from a click
 * and a body registered at load time are the same shapes. README.md explains the levels.
 */

import {
  ACTION_PAYLOAD,
  COMPONENT_PROPS,
  DEVICES,
  EVENT_TYPES,
  KNOWN_ACTIONS,
  RENDERED_BUTTON_SIZES,
  RENDERED_INPUT_SIZES,
  USERS_TYPES,
} from "../contract.mjs";

/** Deep enough for any real tree; a cycle would otherwise recurse forever. */
const MAX_TREE_DEPTH = 20;

/** `Actions.showModal` is "show-modal": the enum key is the usual mistake. */
const asActionValue = (key) =>
  `${key}`.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

export class ShapeChecks {
  /**
   * @param {{
   *   findings: import("./findings.mjs").Findings,
   *   project: import("./plugin-project.mjs").PluginProject,
   * }} context
   */
  constructor({ findings, project }) {
    this.findings = findings;
    this.project = project;
  }

  error(code, message) {
    this.findings.error(code, message);
  }

  warn(code, message) {
    this.findings.warn(code, message);
  }

  // --- items ----------------------------------------------------------------

  /** One registered item, against the contract of the scope that registered it. */
  item(scope, contract, key, item) {
    const where = `${scope} item "${key}"`;

    for (const field of contract.required)
      if (item[field] === undefined)
        this.error("item", `${where} has no ${field}`);

    this.#checkFilterFieldName(where, scope, contract, item);

    this.filterValues(where, contract.filter, item[contract.filter]);
    this.filterValues(where, "devices", item.devices);

    // The tab body and the article button body are rendered as-is at load time.
    this.componentTree(`${where} body`, item.body);

    if (
      typeof item.icon === "string" &&
      !this.project.assetNames.includes(item.icon)
    )
      this.error("item", `${where} icon "${item.icon}" is not in assets/`);

    this.#checkScopeSpecifics(where, scope, item);

    // A scope keyed by extension has no room for a prefix - the key has to be exactly
    // the file's own extension, or the click never dispatches.
    if (contract.key === "key") this.#checkKeyIsNamespaced(where, key);
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
      scope === "ContextMenu" &&
      !item.onItemClick &&
      !item.onClick &&
      !item.items
    )
      this.error(
        "item",
        `${where} has neither onItemClick/onClick nor nested items`,
      );

    if (
      scope === "ContextMenu" &&
      item.items?.some((child) => child.items?.length)
    )
      this.warn(
        "item",
        `${where} nests deeper than 2 levels - the host caps nesting at maxDepth 2`,
      );
  }

  /** Item keys share one host-wide map per scope, across every installed plugin. */
  #checkKeyIsNamespaced(where, key) {
    const pluginSlug = this.project.manifest.name;

    if (
      pluginSlug &&
      typeof key === "string" &&
      !key.toLowerCase().includes(pluginSlug.toLowerCase())
    )
      this.warn(
        "item",
        `${where} key is not namespaced - prefix it with "${pluginSlug}-", the manifest's name spelled exactly as it appears there (not pluginName, and not a squashed slug of it). Item keys share one host-wide map per scope, so a generic key collides with another plugin's and one evicts the other`,
      );
  }

  filterValues(where, field, value) {
    if (value === undefined) return;

    if (!Array.isArray(value)) {
      this.error("item", `${where} ${field} must be an array`);
      return;
    }

    const allowed = field === "devices" ? DEVICES : USERS_TYPES;

    for (const entry of value)
      if (!allowed.includes(entry))
        this.error(
          "item",
          `${where} ${field} contains "${entry}", which is not a valid value (${allowed.join(", ")}) - the host compares these exactly, so the item is filtered out for everyone`,
        );
  }

  // --- messages -------------------------------------------------------------

  /** An IMessage as a callback returned it: known actions, and their payloads. */
  message(where, message) {
    if (message === undefined || message === null) return;

    if (!Array.isArray(message.actions)) {
      this.warn(
        "message",
        `${where} returned a message without an actions array`,
      );
      return;
    }

    // Prefer the SDK the project installed - it is the authority on which action strings
    // exist, and may know ones this tool does not.
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
    }

    if (message.modalDialogProps !== undefined)
      this.modal(where, message.modalDialogProps);
  }

  /** IModalDialog has two mandatory callbacks that are easy to leave out. */
  modal(where, modal) {
    if (!modal || typeof modal !== "object") return;

    if (typeof modal.onLoad !== "function")
      this.error(
        "message",
        `${where} opens a modal whose onLoad is not a function - IModalDialog.onLoad is required even when there is nothing async to do; return the body you already built`,
      );

    if (typeof modal.onClose !== "function")
      this.error(
        "message",
        `${where} opens a modal without onClose - the close button does nothing`,
      );

    if (modal.dialogBody === undefined)
      this.error("message", `${where} opens a modal without dialogBody`);

    this.componentTree(`${where} modal body`, modal.dialogBody);
    this.componentTree(`${where} modal footer`, modal.dialogFooter);
  }

  // --- component trees ------------------------------------------------------

  /**
   * Walks a declarative UI tree and checks every node can render. `node` is an IBox or a
   * {component, props} pair; both nest through `children`.
   */
  componentTree(where, node, depth = 0) {
    if (!node || typeof node !== "object" || depth > MAX_TREE_DEPTH) return;

    if (Array.isArray(node)) {
      for (const child of node) this.componentTree(where, child, depth + 1);
      return;
    }

    // A bare IBox carries its children directly; only a component node has props.
    if (node.component === undefined) {
      this.#checkBoxProps(where, node);
      this.componentTree(where, node.children, depth + 1);
      return;
    }

    const required = COMPONENT_PROPS[node.component];

    if (required === undefined) {
      this.error(
        "component",
        `${where} uses component "${node.component}", which the host cannot render (known: ${Object.keys(COMPONENT_PROPS).join(", ")})`,
      );
      return;
    }

    for (const prop of required)
      if (node.props?.[prop] === undefined)
        this.error(
          "component",
          `${where} has a ${node.component} without ${prop} - nothing wraps the plugin tree in an error boundary, so this throws during render and replaces the whole portal with an error screen`,
        );

    this.#checkVisuals(where, node);

    this.componentTree(where, node.props?.children, depth + 1);
  }

  /**
   * Values that compile against the SDK and then render wrong on the portal. They mostly
   * do not crash - the plugin ships and the control is collapsed, blank or mismatched.
   */
  #checkVisuals(where, node) {
    const props = node.props ?? {};

    if (
      node.component === "button" &&
      typeof props.size === "string" &&
      !RENDERED_BUTTON_SIZES.includes(props.size)
    )
      this.warn(
        "component",
        `${where} button size "${props.size}" has no styles on the portal, so the button renders collapsed - sizes that render: ${RENDERED_BUTTON_SIZES.join(", ")} (ButtonSize.extraSmall is the usual culprit: the SDK emits "extra-small", the host only knows "extraSmall")`,
      );

    if (
      node.component === "input" &&
      typeof props.size === "string" &&
      !RENDERED_INPUT_SIZES.includes(props.size)
    )
      this.warn(
        "component",
        `${where} input size "${props.size}" has no styles on the portal, so the field renders collapsed - sizes that render: ${RENDERED_INPUT_SIZES.join(", ")} (InputSize.big and InputSize.huge compile and are dead)`,
      );

    if (node.component === "comboBox") this.#checkComboBox(where, props);

    if (node.component === "box") this.#checkBoxProps(where, props);
  }

  #checkComboBox(where, props) {
    const { options, selectedOption } = props;

    if (options !== undefined && !Array.isArray(options))
      this.error(
        "component",
        `${where} comboBox options must be an array (even when empty) - the host reads options.length during render, and anything else throws and takes the portal down`,
      );

    if (Array.isArray(options)) {
      options.forEach((option, index) => {
        if (!option || typeof option !== "object" || option.key === undefined)
          this.error(
            "component",
            `${where} comboBox option ${index} has no key - the host derives ids from it during render and throws without one`,
          );
        else if (option.label === undefined)
          this.warn(
            "component",
            `${where} comboBox option "${String(option.key)}" has no label - the row renders empty`,
          );
      });

      // The portal matches the selected option by label, not by key.
      const labels = options
        .map((option) => option?.label)
        .filter((label) => label !== undefined);

      if (new Set(labels).size !== labels.length)
        this.warn(
          "component",
          `${where} comboBox has duplicate option labels - the portal matches the selected option by label, so duplicates grey out and block each other`,
        );
    }

    if (
      selectedOption &&
      typeof selectedOption === "object" &&
      (selectedOption.key === undefined || selectedOption.label === undefined)
    )
      this.warn(
        "component",
        `${where} comboBox selectedOption is missing key or label - the closed control renders blank`,
      );
  }

  /** Box props appear both on {component:"box"}.props and directly on bare IBox roots. */
  #checkBoxProps(where, boxProps) {
    if (typeof boxProps?.borderProp === "string")
      this.warn(
        "component",
        `${where} box borderProp is a CSS string, which the host silently ignores - use the object form { width, style, color, radius }`,
      );
  }
}
