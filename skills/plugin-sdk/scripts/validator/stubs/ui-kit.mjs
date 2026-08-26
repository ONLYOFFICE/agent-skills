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
 * The host's @docspace/ui-kit, for a bundle loaded in the validator. Every export is a
 * component nothing renders, and every enum member reads as its own name - which is what
 * the kit's string enums resolve to (ButtonSize.normal === "normal"), so a module-scope
 * constant built from one keeps a plausible value.
 *
 * A Proxy rather than a list: the kit's barrel is wide and de-facto plugin API in full,
 * and a stub that had to enumerate it would age faster than the contract it serves.
 */

const memberProxy = (name) =>
  new Proxy(function UiKitStub() {}, {
    get: (_target, property) => {
      if (property === Symbol.toPrimitive || property === "toString" || property === "valueOf")
        return () => name;
      if (typeof property === "symbol") return undefined;
      // Enum access: ButtonSize.normal -> "normal".
      return property;
    },
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
// `import { Button } from "@docspace/ui-kit"` into a namespace import over this default.
export default kit;
