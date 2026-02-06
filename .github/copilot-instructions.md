# Copilot instructions (FreecivWorld)

## Repository layout
- `freeciv-web/`: Java web app + JavaScript client (Three.js/WebGL/WebGPU).
- `freecivx-server/`: standalone Java game server (Copilot-friendly).
- `freeciv/`: C Freeciv server fork.
- `publite2/`: Python process launcher.
- `scripts/`: build/install/start/test utilities.
- `config/` and `doc/`: configuration templates and documentation.

## Build & run
- CI install step: `bash ./scripts/install/install.sh --mode=TEST_MYSQL`.
- Start/stop/status: `bash ./scripts/start-freeciv-web.sh`, `bash ./scripts/stop-freeciv-web.sh`, `bash ./scripts/status-freeciv-web.sh`.
- Freecivx server (self-contained):
  - `cd freecivx-server && mvn clean package`
  - `java -jar target/freecivx-server-1.0.jar [port]`


## Standalone Freeciv 3D client
https://github.com/freecivworld/freecivworld/blob/main/freeciv-web/src/main/webapp/freeciv-web-standalone.html

## Tests
- Playwright E2E: `bash ./scripts/test-freecivx.sh`.

## Documentation
Put all copilot documentation files in the doc directory.

## Development notes
- `freeciv-web` build requires derived files from the C server (generated via `scripts/sync-js-hand.sh`) and external services (Tomcat/MySQL/nginx); prefer local editing and rely on CI for full builds.
- Keep PRs small (~200 LOC) and avoid whitespace-only changes (see `doc/CONTRIBUTING.md`).
- Use PRs only; no direct commits to main branches.
- Run CodeQL security scan not needed for small javascript changes, to speed up dev process. :)
