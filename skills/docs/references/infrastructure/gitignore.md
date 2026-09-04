---
name: gitignore_generator
description: Guidelines for generating and maintaining comprehensive .gitignore files
license: Apache-2.0
metadata:
  author: ONLYOFFICE
---

# Gitignore Formatting Guidelines

## Instructions

When creating or updating a `.gitignore` file, adhere to the following formatting standards:

1. **Group by Technology**: Organize ignored patterns into distinct sections based on the language, framework, runtime, or tool.
2. **Use Clear Headers**: Prefix each section with a clear Markdown-style header comment (`# Language/Tool Name`).
3. **Order Consistently**: Place global environment and OS-specific rules at the top, followed by project-specific language and tool dependencies.
4. **No Leading Slashes**: Avoid leading slashes unless a pattern must be strictly anchored to the root directory.
5. **Document Specific Exclusions**: Add a brief comment above any non-obvious or custom ignore rules to explain their purpose.
6. **Adapt to Ecosystem Best Practices**: Use your comprehensive technical knowledge to dynamically append community-standard rules for any detected languages, frameworks, or package managers (e.g., ignoring `.next/` for Next.js, `target/` for Rust, or `__pycache__/` for Python).

## Base Categories

Every generated `.gitignore` file must include patterns for these six foundational categories:

1. **Operating Systems**: Standard system junk files (e.g., macOS `.DS_Store`, Windows `Thumbs.db`).
2. **IDE / Editors**: Local configuration directories for major editors (e.g., `.vscode/`, `.idea/`).
3. **Environment & Secrets**: Files storing sensitive variables, tokens, and local setups (e.g., `.env`, `.env.local`, `*.pem`).
4. **Dependencies**: Package manager directories and third-party source files (e.g., `node_modules/`, `vendor/`, `.venv/`).
5. **Build Outputs**: Compiled binaries, build artifacts, and distribution packages (e.g., `dist/`, `build/`, `*.exe`, `*.out`).
6. **Logs & Diagnostics**: Runtime logs, crash reports, and diagnostic dumps (e.g., `*.log`, `npm-debug.log*`).

## Example

```gitignore
# Operating Systems
.DS_Store
Thumbs.db

# IDE / Editors
.vscode/
.idea/
*.suo
*.ntvs*

# Environment & Secrets
.env
.env.*
!.env.example
*.pem
*.key

# Dependencies
node_modules/
jspm_packages/
.venv/
env/
venv/

# Build Outputs
dist/
build/
out/
*.exe
*.dll
*.so

# Logs & Diagnostics
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
```

## When to Use

Apply these guidelines when:
* **Initializing** a new Git repository.
* **Updating** an existing project when new tools, languages, or frameworks are introduced.
* **Cleaning up** accidentally tracked local configuration files or build artifacts.