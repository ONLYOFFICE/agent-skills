/*
 * (c) Copyright Ascensio System SIA 2026
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

/*
 * The host's @onlyoffice/apps-ui-kit, for a bundle loaded in the validator. Every export is a
 * component nothing renders, and every enum member reads as its own name - which is what
 * the kit's string enums resolve to (ButtonSize.normal === "normal"), so a module-scope
 * constant built from one keeps a plausible value.
 *
 * A Proxy rather than a list: the kit's barrel is wide and de-facto plugin API in full,
 * and a stub that had to enumerate it would age faster than the contract it serves.
 */

/*
 * React inspects an element's type for these before rendering it. A Proxy that answered
 * every property with its own name would hand back a truthy `contextTypes`, and React then
 * treats a kit component as a legacy-context one and warns instead of rendering - so they
 * read as absent, which is what they are on a real kit component.
 */
const REACT_STATICS = new Set([
  "$$typeof",
  "contextTypes",
  "childContextTypes",
  "defaultProps",
  "propTypes",
  "getDerivedStateFromProps",
  "render",
  "_context",
  "_payload",
  "_init",
]);

/**
 * What a kit function that is *not* a component returns. `useTheme()` is the one that
 * matters: a component destructuring its result is correct code, and a stub answering
 * `undefined` would report it as a component that throws while rendering. Any property is
 * another one of these, so `currentColorScheme.main.accent` is as safe as `isBase`; the
 * target is a function so React treats it as a bad child rather than throwing on an object.
 */
const anyValue = (name) =>
  new Proxy(function UiKitValue() {}, {
    get: (_target, property) => {
      if (property === Symbol.toPrimitive || property === "toString" || property === "valueOf")
        return () => name;
      // Array destructuring of a stub value yields undefined rather than "not iterable".
      if (property === Symbol.iterator) return function* empty() {};
      if (typeof property === "symbol") return undefined;
      if (REACT_STATICS.has(property)) return undefined;
      return anyValue(`${name}.${String(property)}`);
    },
    apply: () => anyValue(name),
  });

/** Components are PascalCase in the kit, hooks and helpers are not - and only the latter return a value. */
const isComponentName = (name) => /^[A-Z]/.test(name);

const memberProxy = (name) =>
  new Proxy(function UiKitStub() {}, {
    get: (_target, property) => {
      if (property === Symbol.toPrimitive || property === "toString" || property === "valueOf")
        return () => name;
      if (typeof property === "symbol") return undefined;
      if (REACT_STATICS.has(property)) return undefined;
      if (property === "displayName" || property === "name") return name;
      // Enum access: ButtonSize.normal -> "normal".
      return property;
    },
    // A component renders as nothing (React allows undefined); anything else answers a value.
    apply: () => (isComponentName(name) ? undefined : anyValue(name)),
  });

const kit = new Proxy(
  {},
  {
    get: (_target, property) => {
      if (property === "__esModule") return true;
      if (property === "default") return kit;
      if (typeof property === "symbol") return undefined;
      return memberProxy(String(property));
    },
    has: () => true,
  },
);

// Named exports cannot be produced dynamically from an ES module; the loader rewrites
// `import { Button } from "@onlyoffice/apps-ui-kit"` into a namespace import over this default.
export default kit;
