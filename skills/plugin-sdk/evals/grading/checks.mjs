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
 * The catalogues of checks, and nothing else - the file to open when adding a scenario or
 * tightening a heuristic. Every check is a text or file-system heuristic: a filter saying
 * which runs to read first, not a score to optimise. README.md explains the three.
 */

import {
  arrayGivenTo,
  bodiesOf,
  everyMentionSitsNear,
  isGuarded,
  namesCalledIn,
} from "./source.mjs";
import {
  declaredScopes,
  declaresAnItemScope,
  hasSourceFile,
  manifestField,
  manifestOf,
  sourceFilesOf,
  sourceOf,
  wasPackaged,
} from "./run-output.mjs";
import {
  componentWarningsFor,
  hasNoErrors,
  registeredKeys,
  registeredKeysByScope,
} from "./validator.mjs";
import { NOT_APPLICABLE, UNKNOWN } from "./verdict.mjs";

const REGISTERS_AN_ITEM = /\badd\w+Item\s*\(/;
const CAN_THROW = /\b(fetch|axios)\s*\(|\bJSON\.parse\s*\(|\bawait\b|\.then\s*\(/;
const FETCHES = /\b(fetch|axios)\s*\(/;
const HARDCODED_COLOUR = /(?:\bcolor|[cC]olor|background\w*)\s*:\s*["']#[0-9a-fA-F]{3,8}\b/;

const onLoadCallbackBodiesOf = (sources) =>
  sources.flatMap((source) => bodiesOf(source, "onLoadCallback"));

/**
 * Are items registered inside onLoadCallback rather than at module scope? A preference, not
 * a correctness rule - it matters when the factory reads something set after the bundle
 * runs. Follows one hop, since registration is often delegated to a helper.
 */
const registersInsideOnLoadCallback = (sources) => {
  const everything = sources.join("\n");
  const bodies = onLoadCallbackBodiesOf(sources);
  if (bodies.length === 0) return false;

  if (bodies.some((body) => REGISTERS_AN_ITEM.test(body))) return true;

  return bodies.flatMap(namesCalledIn).some((helper) => {
    const definedAt = everything.search(new RegExp(`\\b${helper}\\s*[=(]`));
    if (definedAt === -1) return false;

    return REGISTERS_AN_ITEM.test(everything.slice(definedAt, definedAt + 1500));
  });
};

export const UNIVERSAL_CHECKS = {
  "zip built": (project) => wasPackaged(project),

  // Without a build the validator can only check the manifest, and it softens the
  // rest to warnings - which would score as clean and mean nothing.
  "validator clean": (project) => (wasPackaged(project) ? hasNoErrors(project) : UNKNOWN),

  "sdk 2.1.x": (project) =>
    /"@onlyoffice\/docspace-plugin-sdk":\s*"[\^~]?2\./.test(manifestOf(project)),

  "name registered correctly": (project) => {
    const pluginName = manifestField(project, "pluginName");
    if (!pluginName) return false;

    return new RegExp(`window\\.Plugins\\.${pluginName}\\s*=`).test(sourceOf(project));
  },

  "registers in onLoadCallback": (project) => {
    const sources = sourceFilesOf(project);

    if (!REGISTERS_AN_ITEM.test(sources.join("\n"))) {
      // All-non-item scopes have nothing to register, so there is no question here. An
      // item scope that registers nothing is a defect - the portal shows nothing.
      return declaresAnItemScope(project) ? false : NOT_APPLICABLE;
    }

    return registersInsideOnLoadCallback(sources);
  },

  "keys namespaced": (project) => {
    const name = manifestField(project, "name");
    if (!name) return false;

    // What the bundle registered, when it can be loaded: source text cannot separate an
    // item key from a comboBox option key, and demanding the prefix on one is wrong.
    const byScope = registeredKeysByScope(project);

    if (byScope) {
      // The File scope keys its map by the extension, which has to be exactly the
      // file's own (".journal") - there is no room for a prefix, so asking for one
      // would mark every correct File plugin down.
      const keys = Object.entries(byScope)
        .filter(([scope]) => scope !== "File")
        .flatMap(([, scopeKeys]) => scopeKeys);

      if (keys.length > 0) return keys.every((key) => String(key).includes(name));

      return declaresAnItemScope(project) && !byScope.File ? false : NOT_APPLICABLE;
    }

    const source = sourceOf(project);
    const literals = [...source.matchAll(/\bkey:\s*"([^"]+)"/g)].map(([, key]) => key);

    // Keys are often lifted into a constant, so a literal search alone gives
    // false negatives - fall back to looking for the prefix anywhere in source.
    if (literals.length === 0) {
      if (!declaresAnItemScope(project) && !REGISTERS_AN_ITEM.test(source)) return NOT_APPLICABLE;

      return new RegExp(`"${name}[-_][^"]*"`).test(source);
    }

    return literals.every((key) => key.includes(name));
  },

  // The rule is "every callback that fetches or parses needs its own try/catch", so a
  // plugin with nothing that can throw has nothing to catch - NA, not a shortfall.
  "errors handled": (project) => {
    const source = sourceOf(project);
    if (!CAN_THROW.test(source)) return NOT_APPLICABLE;

    return /\bcatch\s*[({]/.test(source);
  },

  "no fetch in onLoadCallback": (project) =>
    !onLoadCallbackBodiesOf(sourceFilesOf(project)).some((body) => FETCHES.test(body)),

  "no dead visual values": (project) => {
    if (!wasPackaged(project)) return UNKNOWN;

    const warnings = componentWarningsFor(project);
    return warnings ? warnings.length === 0 : false;
  },

  // Hardcoded hex in a colour-ish prop breaks in the other theme and on
  // re-branded portals; the theme variables are always available instead.
  "colors via theme vars": (project) => !HARDCODED_COLOUR.test(sourceOf(project)),
};

/*
 * Checks more than one scenario wants. Keeping one definition means a fix to the
 * heuristic lands everywhere it is used.
 */

const savesSettingsFromAClick = (project) =>
  everyMentionSitsNear(sourceOf(project), "saveSettings", "onClick");

const parsesStoredSettingsDefensively = (project) => {
  const source = sourceOf(project);
  if (!/setAdminPluginSettingsValue/.test(source)) return false;

  return isGuarded(source, "setAdminPluginSettingsValue") ?? false;
};

const keepsComboBoxInSync = (project) => {
  const source = sourceOf(project);
  if (!/Components\.comboBox/.test(source)) return NOT_APPLICABLE;

  return (
    /\boptions\s*:/.test(source) &&
    /\bselectedOption\s*:/.test(source) &&
    /\bonSelect\s*:/.test(source) &&
    bodiesOf(source, "onSelect").some((body) => /updateProps/.test(body))
  );
};

const implementsInfoPanel = (project) =>
  declaredScopes(project).includes("InfoPanel") && /addInfoPanelItem\s*\(/.test(sourceOf(project));

/**
 * Like everyMentionSitsNear, but for a feature the scenario requires: an anchor that never
 * appears is a shortfall, not a question that does not apply.
 */
const requiredNear = (source, anchor, needle) => {
  const verdict = everyMentionSitsNear(source, anchor, needle);
  return verdict === NOT_APPLICABLE ? false : verdict;
};

/** What the bundle registered for one scope, or UNKNOWN when the report cannot say. */
const registersInScope = (project, scope) => {
  const byScope = registeredKeysByScope(project);
  if (!byScope) return UNKNOWN;

  return (byScope[scope] ?? []).length > 0;
};

const isNewerThan = (version, floor) => {
  const parse = (text) => text.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const [left, right] = [parse(version), parse(floor)];

  for (let index = 0; index < 3; index++)
    if ((left[index] ?? 0) !== (right[index] ?? 0)) return (left[index] ?? 0) > (right[index] ?? 0);

  return false;
};

export const SCENARIO_CHECKS = {
  "file-type-and-actions": {
    // The click dispatch matches the map key against the file's fileExst, dot included -
    // "journal" instead of ".journal" registers cleanly and never fires. Asked of the
    // bundle rather than the source, because the extension is usually a constant.
    "extension claimed with the dot": (project) => {
      const extensions = registeredKeysByScope(project)?.File;
      if (!extensions) return UNKNOWN;

      return extensions.length > 0 && extensions.every((ext) => /^\.[a-z0-9]+$/i.test(ext));
    },

    "File map filled in the bundle": (project) => registersInScope(project, "File"),

    "menu item filtered to the extension": (project) => {
      const extensions = arrayGivenTo(sourceOf(project), "fileExt");
      return extensions === null ? false : /["'`]\.?[a-z0-9]+["'`]/i.test(extensions);
    },

    "creation uses the portal's create dialog": (project) =>
      requiredNear(sourceOf(project), "showCreateDialogModal", "createDialogProps"),

    /*
     * The dialog's `extension` field only drives the "don't ask again" checkbox; the host
     * never appends it, so an onSave saving the bare name creates the wrong file. The
     * extension comes from the bundle, and the name it is appended to may be a constant,
     * so accept either the literal or a mention of the extension's own identifier.
     */
    "extension appended in onSave": (project) => {
      const [extension] = registeredKeysByScope(project)?.File ?? [];
      if (!extension) return UNKNOWN;

      const source = sourceOf(project);
      const bodies = bodiesOf(source, "onSave");
      if (bodies.length === 0) return UNKNOWN;

      const constantNames = [
        ...source.matchAll(/\b([A-Z][A-Z0-9_]*)\s*=\s*["']\.[a-z0-9]+["']/gi),
      ].map(([, name]) => name);

      return bodies.some(
        (body) => body.includes(extension) || constantNames.some((name) => body.includes(name)),
      );
    },

    "upload is the two-step session flow": (project) => {
      const source = sourceOf(project);
      return /create_session/.test(source) && /\blocation\b/.test(source);
    },

    // Every endpoint wraps its payload; forgetting .response yields an object that looks
    // plausible in the debugger and has none of the fields.
    "API responses unwrapped via .response": (project) => {
      const source = sourceOf(project);
      if (!FETCHES.test(source)) return NOT_APPLICABLE;

      return /\.response\b/.test(source);
    },

    // One icon serves rows, table and tiles alike; fileTileIcon is carried and never rendered.
    "fileRowIcon shipped": (project) => /fileRowIcon\s*:/.test(sourceOf(project)),

    "tree uses the Components enum": (project) => {
      const source = sourceOf(project);
      return /component:\s*Components\./.test(source) && !/component:\s*["']/.test(source);
    },

    "modalDialogProps complete": (project) => {
      const source = sourceOf(project);
      if (!/modalDialogProps/.test(source)) return false;

      return ["displayType", "dialogHeader", "dialogBody", "onClose", "onLoad"].every((field) =>
        new RegExp(`\\b${field}\\s*:`).test(source),
      );
    },

    // The host assigns header, body and footer together, so an onLoad that
    // returns only the body wipes the other two.
    "modal onLoad returns every section": (project) => {
      const source = sourceOf(project);
      if (!/newDialogBody/.test(source)) return NOT_APPLICABLE;

      return /newDialogHeader/.test(source) && /newDialogFooter/.test(source);
    },

    "comboBox kept in sync": keepsComboBoxInSync,

    // `--error-color` does not exist. It reads like it should, it compiles into
    // an inline style, and it renders as no colour at all.
    "error via --input-error-color": (project) => {
      const source = sourceOf(project);
      return /var\(--input-error-color\)/.test(source) && !/--error-color\b/.test(source);
    },

    "error label updated by contextName": (project) => {
      const source = sourceOf(project);
      return /\bcontextName\s*:/.test(source) && /updateContext/.test(source);
    },
  },

  "settings-events-and-progress": {
    "saveSettings from a click": savesSettingsFromAClick,
    "settings parsed defensively": parsesStoredSettingsDefensively,
    "comboBox kept in sync": keepsComboBoxInSync,

    "toggle onChange takes no arguments": (project) => {
      const source = sourceOf(project);
      if (!/Components\.toggleButton/.test(source)) return NOT_APPLICABLE;

      return /onChange:\s*(?:async\s*)?\(\s*\)\s*(?::[^=]*)?=>/.test(source);
    },

    // The switch's inner label is absolutely positioned, so the component has no
    // intrinsic size and overlaps whatever follows it.
    "toggle given explicit dimensions": (project) => {
      const source = sourceOf(project);
      if (!/Components\.toggleButton/.test(source)) return NOT_APPLICABLE;

      return /heightProp\s*:/.test(source);
    },

    "InfoPanel declared and implemented": implementsInfoPanel,

    // The complement of "no fetch in onLoadCallback": kept out of the wrong place, it has
    // to be in the right one.
    "panel content fetched in an onLoad": (project) => {
      const source = sourceOf(project);
      if (!FETCHES.test(source)) return NOT_APPLICABLE;

      return bodiesOf(source, "onLoad").some((body) => FETCHES.test(body) || /\bawait\b/.test(body));
    },

    "eventType from the Events enum": (project) => /Events\./.test(sourceOf(project)),

    // The host's wrapper passes nothing, so a handler declaring a parameter reads undefined.
    "eventHandler takes no arguments": (project) => {
      const source = sourceOf(project);
      if (!/eventHandler/.test(source)) return false;

      return /eventHandler\s*:\s*(?:async\s*)?\(\s*\)\s*(?::[^=]*)?=>/.test(source);
    },

    // Once an event has fired the host honours only item updates and toasts - a modal
    // opened from the handler is silently ignored.
    "event handler stays inside toasts and updates": (project) => {
      const bodies = sourceFilesOf(project).flatMap((source) => bodiesOf(source, "eventHandler"));
      if (bodies.length === 0) return UNKNOWN;

      return !bodies.some((body) => /showModal|showSelector|showMediaViewer/.test(body));
    },

    "listener and sidebar scopes both filled": (project) => {
      const listener = registersInScope(project, "EventListener");
      const button = registersInScope(project, "ArticleButton");
      if (listener === UNKNOWN || button === UNKNOWN) return UNKNOWN;

      return listener && button;
    },

    // The 32x32 slot has no click handler of its own and clips anything larger, so the
    // body has to be a single interactive icon - and of the components that fit, only
    // iconButton has an onClick the host wires up.
    "article body is an interactive icon": (project) =>
      requiredNear(sourceOf(project), "Components\\.iconButton", "\\bonClick\\s*:"),

    /*
     * A bulk action on existing rooms belongs in the context menu, where the user's own
     * selection is the input. A main-button entry plus a room selector is the shape this
     * request invites and the wrong one: MainButton is where the portal puts creation, and
     * a plugin cannot drive multi-selection in the Room selector at all.
     */
    "bulk export is a context menu group action": (project) => {
      const source = sourceOf(project);
      return /isGroupAction\s*:\s*true/.test(source) && /onGroupClick\s*:/.test(source);
    },

    "uses the floating operations button": (project) =>
      /addFloatingOperationsButton/.test(sourceOf(project)),

    "operations carry the fields the host renders": (project) => {
      const source = sourceOf(project);
      if (!/floatingOperationsButtonProps/.test(source)) return false;

      return ["label", "operation", "alert", "completed"].every((field) =>
        new RegExp(`\\b${field}\\s*:`).test(source),
      );
    },

    "operation typed from the enum": (project) => /FloatingOperationType\./.test(sourceOf(project)),

    // Add ignores an id already registered and update ignores one that is not, so an
    // update sent first is a silent no-op and progress never appears.
    "progress advanced with an update": (project) =>
      /updateFloatingOperationsButton/.test(sourceOf(project)),

    "progress reported without holding a modal open": (project) => {
      const source = sourceOf(project);
      return !/showModal/.test(source) || /updateFloatingOperationsButton/.test(source);
    },
  },

  "extend-with-external-tool": {
    // The portal keys an installed plugin by these two, so renaming either orphans the
    // installation - the expensive kind of wrong.
    "identity preserved": (project) =>
      manifestField(project, "name") === "room-notes" &&
      manifestField(project, "pluginName") === "RoomNotes",

    "version bumped": (project) =>
      isNewerThan(manifestField(project, "version") || "0.0.0", "1.2.0"),

    "existing item kept": (project) => {
      const keys = registeredKeys(project);
      return /room-notes-edit/.test(keys ? keys.join(" ") : sourceOf(project));
    },

    // A regenerated scaffold does not carry the fixture's own files, so their
    // survival is the cheapest evidence that the project was edited in place.
    "edited in place": (project) => hasSourceFile(project, "locales.ts"),

    "labels go through locales": (project) =>
      !/(?:label|title)\s*:\s*["'][A-Za-z]/.test(sourceOf(project)),

    "ProfileMenu filled in the bundle": (project) => registersInScope(project, "ProfileMenu"),

    // This scope has no onItemClick, and the host calls its onClick with nothing.
    "profile onClick takes no arguments": (project) => {
      const source = sourceOf(project);
      if (!declaredScopes(project).includes("ProfileMenu")) return false;

      return /onClick:\s*(?:async\s*)?\(\s*\)\s*(?::[^=]*)?=>/.test(source);
    },

    // The scpDomains typo ships in real plugins and silently does nothing - the request
    // is then blocked by the portal's CSP with no hint pointing at the manifest.
    "cspDomains lists the tool's origin": (project) => {
      const manifest = manifestOf(project);

      return (
        /"cspDomains"\s*:\s*\[[^\]]*notes\.example\.com/.test(manifest) &&
        !/scpDomains/.test(manifest)
      );
    },

    "PostMessage scope declared and wired": (project) =>
      declaredScopes(project).includes("PostMessage") &&
      /setPostMessageCallback/.test(sourceOf(project)),

    "iFrame carries a DOM id": (project) =>
      requiredNear(sourceOf(project), "Components\\.iFrame", "\\bid\\s*:"),

    "embed opens as an aside": (project) => /ModalDisplayType\.aside/.test(sourceOf(project)),

    // Plugin code runs in a hidden iframe, so a listener on its own window hears nothing.
    "listener sits on window.parent": (project) =>
      /window\.parent\.addEventListener/.test(sourceOf(project)),

    "message origin is checked": (project) => {
      const source = sourceOf(project);
      if (!/addEventListener\s*\(\s*["']message["']/.test(source)) return false;

      return /\.origin\b/.test(source);
    },

    "confirmation goes through postMessageCallback": (project) =>
      /postMessageCallback\s*\(/.test(sourceOf(project)),
  },
};

/*
 * Prose checks for audit/explain scenarios. Currently empty: the suite carries only build
 * scenarios. The machinery stays (grade.mjs, proseIn, the audit/explain modes) so an audit
 * scenario grown from a real failure report can be added back as one entry here.
 */
export const REPORT_CHECKS = {};
