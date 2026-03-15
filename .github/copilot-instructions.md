# Copilot instructions (FreecivWorld)

Freecivworld is the 3D version of Freeciv, with 2d map view and 3d map view.

## Repository layout
- `freeciv-web/`: Java web app + JavaScript client (Three.js/WebGPU).
- `freeciv/`: C Freeciv server fork.
- `publite-go/`: Python process launcher.
- `scripts/`: build/install/start/test utilities.
- `config/` and `doc/`: configuration templates and documentation.
- `freeciv-scores-go` elo scores process.
- `freecivx-server` Freeciv Java server.

## Build & run
- CI install step: `bash ./scripts/install/install.sh --mode=TEST_MYSQL`.
- /freeciv-web/build.sh

## Documentation
Put all copilot documentation files in the doc directory.

## Development notes
- `freeciv-web` build requires derived files from the C server (generated via `scripts/sync-js-hand.sh`) and external services (Tomcat/MySQL/nginx); prefer local editing and rely on CI for full builds.
- Keep PRs small (~200 LOC) and avoid whitespace-only changes (see `doc/CONTRIBUTING.md`).
- Use PRs only; no direct commits to main branches.
- Run CodeQL security scan not needed for small javascript changes, to speed up dev process. :)
- No need to check if fuctions are defined all the time.  typeof current_focus !== 'undefined'
- When doing changes to the "Freeciv server", this means the freeciv directory. Do not modify "freecivx-server" unless directly told to.
- do not create java tests for freecivx-server
- don't change Java version requirement 
