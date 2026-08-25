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
 * Reading meaning out of TypeScript source text - the primitives the plugin-specific checks
 * are built from, knowing nothing about DocSpace. Heuristics by construction, which is why
 * several answer "could not tell" rather than guessing.
 */

import { NOT_APPLICABLE, UNKNOWN } from "./verdict.mjs";

export const withoutComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

/**
 * Where a definition's body starts, given the position just after its name. Taking the next
 * `{` grades a return type instead of the code, so step over the parameter list and the
 * annotation and stop at a separator - `onLoad: someHelper,` has no body of its own.
 */
const bodyBraceAfter = (source, startAt) => {
  let parenDepth = 0;
  let angleDepth = 0;
  let afterArrow = false;

  for (let position = startAt; position < source.length; position++) {
    const character = source[position];

    /*
     * Past the arrow everything left is the body, so the parameter list no longer
     * counts - and a concise arrow returning an object wraps it in parentheses
     * (`onLoad: async () => ({ body: await load() })`), which would otherwise hide
     * the literal behind a paren depth of 1 and report the callback as bodyless.
     */
    if (character === "=" && source[position + 1] === ">") {
      afterArrow = true;
      parenDepth = 0;
      position += 1;
      continue;
    }

    if (character === "(") parenDepth++;
    else if (character === ")") parenDepth--;
    else if (character === "<") angleDepth++;
    // `>` closes a type argument, unless it is the tail of an arrow.
    else if (character === ">" && source[position - 1] !== "=") angleDepth--;
    else if (angleDepth <= 0 && (parenDepth <= 0 || (afterArrow && parenDepth <= 1))) {
      if (character === "{") return position;
      // Before the arrow a separator means there was never a body of its own:
      // `onLoad: someHelper,` delegates rather than defining one.
      if (!afterArrow && (character === "," || character === ";")) return -1;
    }
  }

  return -1;
};

/**
 * The body of every definition of `name`, brace-matched rather than sliced, so a long
 * callback is not truncated. The name has to end where it is written, or asking for
 * `onLoad` also finds every `onLoadCallback`.
 */
export const bodiesOf = (source, name) => {
  const bodies = [];
  const definition = new RegExp(`\\b${name}(?![A-Za-z0-9_$])`, "g");

  for (const mention of source.matchAll(definition)) {
    const afterName = source.slice(mention.index + name.length);

    // `name(argument)` is a call site, not a definition. Empty parens are left alone so a
    // method shorthand still counts.
    if (/^\s*\([^)]/.test(afterName)) continue;

    const opening = bodyBraceAfter(source, mention.index + name.length);
    if (opening === -1) continue;

    let depth = 0;

    for (let position = opening; position < source.length; position++) {
      if (source[position] === "{") depth++;
      else if (source[position] === "}" && --depth === 0) {
        bodies.push(source.slice(opening, position + 1));
        break;
      }
    }
  }

  return bodies;
};

/** The names of everything called inside a block of code. */
export const namesCalledIn = (body) => [...body.matchAll(/\b(\w+)\s*\(/g)].map(([, name]) => name);

/**
 * The array a property was given, following one hop when the list was lifted into a
 * constant. Null when there is no array to be found.
 */
export const arrayGivenTo = (source, property) => {
  const value = source.match(new RegExp(`\\b${property}\\s*:\\s*([^,\\n]+)`))?.[1]?.trim() ?? "";
  if (!value) return null;

  if (value.startsWith("["))
    return source.match(new RegExp(`\\b${property}\\s*:\\s*\\[([^\\]]*)\\]`))?.[1] ?? "";

  const constantName = value.match(/^[A-Za-z_$][\w$]*/)?.[0];
  if (!constantName) return null;

  return source.match(new RegExp(`\\b${constantName}\\b[^=\\n]*=\\s*\\[([^\\]]*)\\]`))?.[1] ?? null;
};

/**
 * Does every mention of `anchor` sit near a mention of `needle`? A few lines either way,
 * the way a reader glances. Not applicable when the anchor never appears.
 */
export const everyMentionSitsNear = (source, anchor, needle, radius = 700) => {
  const mentions = [...source.matchAll(new RegExp(anchor, "g"))];
  if (mentions.length === 0) return NOT_APPLICABLE;

  return mentions.every((mention) =>
    new RegExp(needle).test(
      source.slice(Math.max(0, mention.index - radius), mention.index + radius),
    ),
  );
};

/**
 * Does `name`'s body guard itself, directly or through a helper it calls? One hop, since a
 * project that moved its parsing out is where the callback alone misleads.
 */
export const isGuarded = (source, name) => {
  const bodies = bodiesOf(source, name);
  if (bodies.length === 0) return UNKNOWN;

  const catchesDirectly = bodies.some((body) => /\bcatch\s*[({]/.test(body));
  if (catchesDirectly) return true;

  return bodies
    .flatMap(namesCalledIn)
    .some((helper) => bodiesOf(source, helper).some((body) => /\bcatch\s*[({]/.test(body)));
};
