# Repository Guidelines

## Project Structure & Module Organization

This repository recreates ADI 4 Sciences as a static browser application.

- `web/index.html` and `web/public/app.js` initialize the application.
- `web/public/application/` owns routing and the shared shell; `features/` groups courses, room interactions, science simulations, and games. Keep game rules in DOM-independent `engine.js` modules and rendering in `view.js`.
- `web/public/styles/` contains stylesheets; `game/` contains assets and manifests; `vendor/wgob3/` contains the compiled third-party engine.
- `web/tests/` contains JavaScript tests and fixtures. `scripts/` contains Python extraction, asset preparation, deployment tools, and Python tests.
- `reports/` documents reverse engineering; `deploy/` documents AWS hosting. Consult `web/ARCHITECTURE.md` before changing module boundaries.

## Build, Test, and Development Commands

Run from the repository root with Node.js 22+. No `npm install` is required.

- `npm --prefix web run dev`: serve locally at `http://127.0.0.1:4173`.
- `npm --prefix web run check`: check JavaScript syntax.
- `npm --prefix web test`: run the Node.js test suite.
- `npm --prefix web run build`: generate the static distribution in `web/dist/`.
- `npm --prefix web run preview`: serve the generated distribution.
- `python3 -m unittest discover -s scripts -p 'test_*.py' -v`: run Python tests; extraction-dependent cases require original local resources and relevant tool dependencies.

## Coding Style & Naming Conventions

Use native JavaScript ES modules, two-space indentation, camelCase identifiers, and descriptive kebab-case filenames. Python uses four-space indentation and snake_case. Follow surrounding code.

`web/.prettierrc.json` specifies single quotes and a 100-character print width. Optional formatting from `web/`: `npx --yes prettier@3.6.2 --write .`. Respect `.prettierignore`; regenerate generated calculations through `scripts/compile_calculations.py` rather than editing them manually.

## Testing Guidelines

Use `node:test` with `node:assert/strict` in `web/tests/*.test.mjs` and Python `unittest` in `scripts/test_*.py`. No numeric coverage threshold is configured. Add behavioral regressions for changed rules, saves, asset integrity, or build imports. Run check, tests, and build; verify affected screens using preview and capture screenshots for visual changes.

## Commit & Pull Request Guidelines

History uses scoped Conventional Commits, such as `feat(web): add Adi mascot logo to site header` and `refactor(web): organize feature modules`. Keep commits focused. PRs should describe behavior changes, validation, relevant issues, screenshots for UI changes, and remaining porting limitations.

Before every commit, systematically review the tracked README files and check
whether the changes require updates to setup, usage, available features,
limitations, or file references. Update them before committing when needed;
local repository links must refer only to tracked files or tracked directories.

Before every commit, systematically review « À propos de cette version » and check whether the changes require updating its content. If needed, update it before committing so that the description of available features and remaining limitations stays accurate.

## Assets & Deployment

Keep installers, `extracted/`, credentials, and generated distributions out of Git. Preserve bundled assets, licenses, stable asset URLs, and browser-save keys. Follow `deploy/README.md`; obtain Christophe’s explicit approval for the version before publishing with `--apply`.

## Private hosting information

Never include personal deployment domains, private hosting URLs, or links to the
maintainer’s deployed instance in tracked files, commit messages, or GitHub
repository metadata. Use localhost examples or generic deployment instructions.
Keep deployment addresses and configuration outside the public repository.
