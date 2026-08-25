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
 * How a check answers, and how answers turn into a score. A check returns `true`, `false`,
 * UNKNOWN (applies but could not decide - read the run) or NOT_APPLICABLE (nothing here for
 * it to be about, so left out of the score). ../README.md explains why the last two differ.
 */

export const UNKNOWN = null;
export const NOT_APPLICABLE = "n/a";

export const scoreOf = (results, labels) => {
  const applicable = labels.filter((label) => results[label] !== NOT_APPLICABLE);

  return {
    passed: applicable.filter((label) => results[label] === true).length,
    total: applicable.length,
    unknown: applicable.filter((label) => results[label] === UNKNOWN).length,
  };
};
