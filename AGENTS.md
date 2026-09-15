# Repository Guidelines

## Project Structure & Module Organization

This repository recreates ADI 4 Sciences as a static browser application.

## Fidelity and completion

Fidelity to the original game is the primary objective. Do not choose an easier
implementation at the expense of original behavior. Verify interactions, rules,
animations, ambient sequences, sound, timing, and visual details against the
original assets, scripts, and runtime. Use reverse engineering where necessary.
Finishing these details is required work, not an optional enhancement. Keep
remaining differences explicitly documented until they are resolved; a playable
screen alone does not establish that its recreation is complete.

- `web/index.html` and `web/public/app.js` initialize the application.
- `web/public/application/` owns routing and the shared shell; `features/` groups courses, room interactions, science simulations, and games. Keep game rules in DOM-independent `engine.js` modules and rendering in `view.js`.
- `web/public/styles/` contains stylesheets; `game/` contains assets and manifests; `vendor/wgob3/` contains the compiled third-party engine.
- `web/tests/` contains JavaScript tests and fixtures; `web/tooling/` contains resource integrity and source inventory tools.
- `serveur/` contains the original client’s TCP server, administration tools, and Python tests. Consult `web/ARCHITECTURE.md` before changing module boundaries.

## Build, Test, and Development Commands

Run from the repository root with Node.js 22+. No `npm install` is required.

- `npm --prefix web run dev`: serve locally at `http://127.0.0.1:4173`.
- `npm --prefix web run check`: check JavaScript syntax.
- `npm --prefix web test`: run the Node.js test suite.
- `npm --prefix web run build`: generate the static distribution in `web/dist/`.
- `npm --prefix web run preview`: serve the generated distribution.
- `python3 -m unittest discover -s serveur -p 'test_*.py' -v`: run server tests with temporary SQLite databases and loopback sockets.

## Coding Style & Naming Conventions

Use native JavaScript ES modules, two-space indentation, camelCase identifiers, and descriptive kebab-case filenames. Python uses four-space indentation and snake_case. Follow surrounding code.

`web/.prettierrc.json` specifies single quotes and a 100-character print width. Optional formatting from `web/`: `npx --yes prettier@3.6.2 --write .`. Respect `.prettierignore` and keep generated calculations separate from manually maintained modules.

## Testing Guidelines

Use `node:test` with `node:assert/strict` in `web/tests/*.test.mjs` and Python `unittest` in `serveur/test_*.py`. No numeric coverage threshold is configured. Add behavioral regressions for changed rules, saves, asset integrity, or build imports. Run check, tests, and build; verify affected screens using preview and capture screenshots for visual changes.

## Commit & Pull Request Guidelines

History uses scoped Conventional Commits, such as `feat(web): add Adi mascot logo to site header` and `refactor(web): organize feature modules`. Keep commits focused. PRs should describe behavior changes, validation, relevant issues, screenshots for UI changes, and remaining porting limitations.

Before every commit, systematically review the tracked README files and check
whether the changes require updates to setup, usage, available features,
limitations, or file references. Update them before committing when needed;
local repository links must refer only to tracked files or tracked directories.

Before every commit, systematically review « À propos de cette version » and check whether the changes require updating its content. If needed, update it before committing so that the description of available features and remaining limitations stays accurate.

## Assets & Deployment

Keep installers, `extracted/`, credentials, and generated distributions out of Git. Preserve bundled assets, licenses, stable asset URLs, and browser-save keys. Obtain Christophe’s explicit approval for the version before deploying the website.

## Private hosting information

Never include personal deployment domains, private hosting URLs, or links to the
maintainer’s deployed instance in tracked files, commit messages, or GitHub
repository metadata. Use localhost examples or generic deployment instructions.
Keep deployment addresses and configuration outside the public repository.

## Documentation style

Describe the current design, behavior, interfaces, usage, and limitations directly
in the present tense. Write documents as a reference to the code as it is, not as
a record of how it became that way. Do not include implementation timelines,
refactoring narratives, before/after comparisons, session reports, or statements
that a feature was added, replaced, or preserved. Git history records changes.
Descriptions of the original game and runtime behavior remain relevant when they
explain the current implementation. Link only to tracked repository files or
directories; do not rely on private reports, extraction tools, or local test files.
