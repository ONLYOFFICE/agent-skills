#!/usr/bin/env python3
"""Scaffold the Next.js/React/TypeScript reference integration via
ONLYOFFICE's own create-app generator (https://github.com/ONLYOFFICE/create-app),
pinned to a known-good version - fetched fresh into the target directory
rather than vendored inside this skill. Unlike document-templates' binary
files (consumed at the generated app's own runtime), create-app is a
dev-time project generator: there is nothing for the deliverable to load
from it later, so there is nothing to keep vendored locally - only the
exact pinned invocation is worth fixing in one place.

Usage: python3 scaffold.py <project-dir>

The output still needs this skill's Definition of Done applied on top,
not skipped because it came from an official generator:
  - the /convert route made reachable on its own (see endpoints.md and
    example.md's Endpoints note - an upload-triggered internal
    conversion is not the same as a mounted route)
  - JWT_SECRET read from the environment with no hardcoded fallback
  - a full pass through example-checklist.md before calling it done
"""

import subprocess
import sys

PINNED_CREATE_APP_VERSION = "{{PINNED_CREATE_APP_VERSION}}"


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: python3 scaffold.py <project-dir>", file=sys.stderr)
        return 2

    project_dir = sys.argv[1]
    package = f"@onlyoffice/create-app@{PINNED_CREATE_APP_VERSION}"

    result = subprocess.run(
        ["npx", "--yes", package, project_dir, "--skip-install"],
        check=False,
    )
    if result.returncode != 0:
        return result.returncode

    print(
        f"Scaffolded into {project_dir} — apply this skill's Definition of "
        "Done (SKILL.md) before considering it done."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
