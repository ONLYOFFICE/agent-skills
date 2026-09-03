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
 * What is measured in the page, once per theme and direction.
 *
 * Everything here is a *layout* fact - a box that came out the wrong size, two boxes on top
 * of each other, a rule that matched an element the plugin does not own. None of it is
 * reachable without a browser, which is why the validator's render pass cannot see any of
 * it: that pass renders to a string, so nothing has a size and no stylesheet has run.
 *
 * The rule for what belongs here: a finding has to be something the *user* would see on the
 * portal, phrased as what they would see. A measurement that only says "this is unusual" is
 * noise in a report that is meant to be acted on.
 */

/**
 * Runs inside the page. Returns raw observations; the node side turns them into findings, so
 * the wording lives in one place and this function stays a measurement.
 *
 * @param css the plugin's own stylesheet text, or "" - passed in rather than read from the
 *   document, because that is the only way to tell the plugin's rules from the kit's 140.
 */
export const measure = (css) => {
  const MIN_CONTROL = 20; // narrower than this and a control cannot be used or read
  const MIN_HEIGHT = 8;

  const rect = (el) => el.getBoundingClientRect();
  /* Near-zero rather than exactly zero: the standard way to keep a control operable but
   * unseen - which is how the kit builds a switch, a checkbox and a file picker - is an
   * input at opacity 0.0001 behind the graphic, and calling that a 13x13px collapsed
   * control was noise on every surface that had one. */
  const visible = (el) => {
    const style = getComputedStyle(el);
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      Number.parseFloat(style.opacity || "1") > 0.05
    );
  };
  const describe = (el) => {
    const id = el.id ? `#${el.id}` : "";
    const cls = typeof el.className === "string" && el.className ? `.${el.className.trim().split(/\s+/)[0]}` : "";
    const testid = el.getAttribute?.("data-testid");
    return `${el.tagName.toLowerCase()}${id}${cls}${testid ? `[${testid}]` : ""}`;
  };
  const label = (el) =>
    (el.getAttribute?.("aria-label") ||
      el.getAttribute?.("placeholder") ||
      el.getAttribute?.("label") ||
      (el.value && String(el.value).slice(0, 24)) ||
      "") + "";

  const CONTROLS = "input, textarea, select, button, [role=button], [role=switch], [role=checkbox]";

  /* A stylesheet built from the plugin's own text: the only way to ask "does one of *your*
   * rules match an element you do not own". Parsing selectors by hand would get the
   * escaping wrong; the CSSOM already knows how. */
  const pluginSelectors = [];
  if (css) {
    const sheet = document.createElement("style");
    sheet.media = "not all"; // parsed, never applied - the applied copy is added separately
    sheet.textContent = css;
    document.head.appendChild(sheet);

    const walk = (rules) => {
      for (const rule of rules) {
        if (rule.selectorText) pluginSelectors.push(rule.selectorText);
        if (rule.cssRules) walk(rule.cssRules);
      }
    };
    try {
      walk(sheet.sheet.cssRules);
    } catch {
      /* an @import or a cross-origin sheet - nothing to walk */
    }
    sheet.remove();
  }

  const observations = { surfaces: [], leaks: [], boot: window.__previewBootError ?? null };

  /* A rule of the plugin's that matches portal-shaped markup restyles the product. The probe
   * holds the elements and class names DocSpace's own DOM is made of, so a match here is the
   * same match the portal would suffer. */
  const probe = document.getElementById("leak-probe");
  if (probe) {
    for (const selector of pluginSelectors) {
      // Only the leftmost compound decides what a rule can escape into.
      for (const part of selector.split(",")) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        let matched;
        try {
          matched = probe.querySelectorAll(trimmed);
        } catch {
          continue;
        }
        if (matched.length || (() => { try { return probe.matches(trimmed); } catch { return false; } })())
          observations.leaks.push({ selector: trimmed, hits: matched.length || 1 });
      }
    }
  }

  for (const root of document.querySelectorAll("[data-surface]")) {
    const where = root.getAttribute("data-surface");
    const declared = Number(root.getAttribute("data-surface-width")) || 0;
    const box = rect(root);
    const surface = {
      where,
      declaredWidth: declared,
      width: Math.round(box.width),
      height: Math.round(box.height),
      overflow: root.scrollWidth > root.clientWidth + 1,
      scrollWidth: root.scrollWidth,
      clientWidth: root.clientWidth,
      blank: false,
      collapsed: [],
      overlaps: [],
      spills: [],
      unlabelled: [],
      noHeight: [],
      invisibleText: [],
    };

    /* A surface with nothing painted in it is the portal's blank tab - and unlike the render
     * pass, effects have run by now, so this catches the component that throws or bails in
     * an effect rather than in render. */
    const painted = [...root.querySelectorAll("*")].filter((el) => {
      const r = rect(el);
      return visible(el) && r.width > 0 && r.height > 0;
    });
    surface.blank = root.textContent.trim() === "" && painted.length === 0;

    for (const el of root.querySelectorAll(CONTROLS)) {
      if (!visible(el)) continue;
      const r = rect(el);

      if (r.width < MIN_CONTROL || r.height < MIN_HEIGHT)
        surface.collapsed.push({
          what: describe(el),
          width: Math.round(r.width),
          height: Math.round(r.height),
          label: label(el).trim(),
        });

      // A field nobody can name: no visible label beside it and nothing to read on it.
      const tag = el.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea") {
        // Trimmed: the kit's TextInput ships `placeholder=" "`, a single space, which names
        // nothing. Taking it at face value made this check unfireable.
        const described =
          el.getAttribute("aria-label")?.trim() ||
          el.getAttribute("placeholder")?.trim() ||
          [...(el.labels ?? [])].some((l) => l.textContent.trim()) ||
          root.querySelector(`label[for="${el.id}"]`)?.textContent.trim();
        if (!described) surface.unlabelled.push({ what: describe(el) });
      }
    }

    /* A box that holds something to read and has no height of its own. This is the
     * ToggleButton trap measured head-on: its label is absolutely positioned, so it adds
     * nothing to the wrapper, the wrapper collapses to 0px, and whatever follows is drawn
     * where the label already is. Pairwise overlap misses it whenever the label is not a
     * leaf, so the height is what gets measured. */
    for (const el of root.querySelectorAll("*")) {
      const r = rect(el);
      if (r.height === 0 && r.width > 2 && visible(el) && el.textContent.trim() !== "")
        surface.noHeight.push({ what: describe(el), width: Math.round(r.width), text: el.textContent.trim().slice(0, 40) });
    }

    /* Two boxes on top of each other. Only leaves are compared - a parent overlapping its
     * child is normal - and only where both carry something to see, which is what makes the
     * absolutely positioned label of a ToggleButton show up here. */
    const leaves = painted.filter((el) => el.children.length === 0 && el.textContent.trim() !== "");
    for (let i = 0; i < leaves.length; i += 1) {
      for (let j = i + 1; j < leaves.length; j += 1) {
        const a = leaves[i];
        const b = leaves[j];
        if (a.contains(b) || b.contains(a)) continue;
        const ra = rect(a);
        const rb = rect(b);
        const overlapX = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
        const overlapY = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        if (overlapX > 2 && overlapY > 2)
          surface.overlaps.push({
            a: describe(a),
            b: describe(b),
            text: (a.textContent.trim() + " / " + b.textContent.trim()).slice(0, 60),
            byX: Math.round(overlapX),
            byY: Math.round(overlapY),
          });
      }
    }

    // Content wider than the surface the portal gives it: the horizontal scrollbar case.
    for (const el of painted) {
      const r = rect(el);
      if (r.width > box.width + 2 && r.width - box.width > 4)
        surface.spills.push({ what: describe(el), width: Math.round(r.width), surface: Math.round(box.width) });
    }

    /* Text the same colour as what is behind it. The usual cause is a literal colour that
     * only works in one theme, which is why this is measured in both. */
    for (const el of painted) {
      if (el.children.length || !el.textContent.trim()) continue;
      const style = getComputedStyle(el);
      let bg = "rgba(0, 0, 0, 0)";
      for (let p = el; p; p = p.parentElement) {
        const candidate = getComputedStyle(p).backgroundColor;
        if (candidate && candidate !== "rgba(0, 0, 0, 0)" && candidate !== "transparent") {
          bg = candidate;
          break;
        }
      }
      if (style.color === bg)
        surface.invisibleText.push({ what: describe(el), color: style.color, text: el.textContent.trim().slice(0, 40) });
    }

    observations.surfaces.push(surface);
  }

  return observations;
};

/** The in-page function as text, for `page.evaluate`. */
export const measureSource = () => `(${measure.toString()})`;
