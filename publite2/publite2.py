#!/usr/bin/env python3
"""
Publite2: A process manager to launch multiple Freeciv-web servers.
"""

import sys
import time
import http.client
import logging
import argparse
from enum import Enum
from pathlib import Path
from pubstatus import PubStatus
from civlauncher import Civlauncher
from config import PubliteConfig, load_config

# Constants
METAHOST = "localhost"
METAPORT = 8080
METAPATH = "/freeciv-web/meta/metaserver"
STATUSPATH = "/freeciv-web/meta/status"
SETTINGS_FILE = "settings.ini"
METACHECKER_INTERVAL = 40
INITIAL_PORT = 6000


logger = logging.getLogger(__name__)


class GameType(Enum):
    SINGLEPLAYER = "singleplayer"
    MULTIPLAYER = "multiplayer"


class MetaChecker:
    def __init__(self, config: PubliteConfig | None = None):
        self.server_list = []
        self.check_count = 0
        self.total = 0
        self.single = 0
        self.multi = 0
        self.last_http_status = -1
        self.html_doc = "-"

        # Load settings using the shared config loader to keep behaviour
        # consistent and testable. Fallback to the legacy path if needed.
        if config is None:
            try:
                config = load_config(SETTINGS_FILE)
            except FileNotFoundError:
                logger.error(
                    "Publite2 isn't set up correctly. Copy %s.dist to %s and update it.",
                    SETTINGS_FILE,
                    SETTINGS_FILE,
                )
                sys.exit(1)

        self.config = config
        self.server_capacity_single = config.server_capacity_single
        self.server_capacity_multi = config.server_capacity_multi
        self.server_limit = config.server_limit
        self.savesdir = config.savesdir

        self._start_pubstatus()

    def _start_pubstatus(self):
        """Start the PubStatus thread."""
        pub_status = PubStatus(self)
        pub_status.start()

    def _fetch_meta_status(self):
        """Fetch the meta status from the Freeciv-web metaserver."""
        try:
            conn = http.client.HTTPConnection(METAHOST, METAPORT)
            conn.request("GET", STATUSPATH)
            response = conn.getresponse()

            self.last_http_status = response.status
            if response.status == 200:
                self.html_doc = response.read().decode("ascii")
                return self.html_doc.split(";")
            logger.error("Invalid metaserver status (HTTP %s)", response.status)
            return None
        except Exception as e:  # noqa: BLE001
            logger.error(
                "Unable to connect to metaserver at http://%s%s. Error: %s",
                METAHOST,
                STATUSPATH,
                e,
            )
            return None
        finally:
            conn.close()

    def _launch_server(self, game_type: GameType, port: int) -> int:
        """Launch a new server for the specified game type."""
        logger.info("Launching %s server on port %s", game_type.value, port)
        new_server = Civlauncher(
            game_type.value,
            game_type.value,
            port,
            f"{METAHOST}:{METAPORT}{METAPATH}",
            self.savesdir,
        )
        self.server_list.append(new_server)
        new_server.start()
        return port + 1

    def _update_counts(self, meta_status: list):
        """Update the server counts based on meta status."""
        self.total = int(meta_status[1])
        self.single = int(meta_status[2])
        self.multi = int(meta_status[3])

    def check(self, port: int):
        """Periodically check the metaserver and launch additional servers if needed."""
        while True:
            time.sleep(METACHECKER_INTERVAL)

            meta_status = self._fetch_meta_status()
            if not meta_status or len(meta_status) != 4:
                continue

            self._update_counts(meta_status)

            while self.single < self.server_capacity_single and self.total < self.server_limit:
                port = self._launch_server(GameType.SINGLEPLAYER, port)
                self.single += 1
                self.total += 1

            while self.multi < self.server_capacity_multi and self.total < self.server_limit:
                port = self._launch_server(GameType.MULTIPLAYER, port)
                self.multi += 1
                self.total += 1


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    """Parse CLI arguments for Publite2.

    Defaults mirror the legacy hard-coded constants so existing deployments
    behave exactly the same when no arguments are provided.
    """
    parser = argparse.ArgumentParser(description="Publite2 Freeciv server manager")
    parser.add_argument(
        "--settings",
        default=SETTINGS_FILE,
        help="Path to settings.ini (default: settings.ini)",
    )
    parser.add_argument(
        "--log-level",
        default="INFO",
        help="Logging level (e.g. DEBUG, INFO, WARNING)",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    """Entrypoint for Publite2.

    Mirrors the legacy behaviour but is now driven by a small CLI and
    configurable logging.
    """
    args = parse_args(argv)

    # Basic logging setup; higher-level tooling can reconfigure if needed.
    logging.basicConfig(
        level=getattr(logging, args.log_level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )

    # Test connection to the metaserver (legacy behaviour).
    try:
        conn = http.client.HTTPConnection(METAHOST, METAPORT)
        conn.request("GET", STATUSPATH)
        response = conn.getresponse()

        if response.status != 200:
            logger.error("Invalid response from metaserver (HTTP %s)", response.status)
            return 1
    except Exception as e:  # noqa: BLE001
        logger.error(
            "Unable to connect to metaserver at http://%s%s. Error: %s",
            METAHOST,
            METAPATH,
            e,
        )
        return 1
    finally:
        conn.close()

    # Load configuration (using the possibly overridden settings path) and
    # initialise MetaChecker with it. This keeps behaviour consistent while
    # making the configuration source explicit.
    try:
        config = load_config(args.settings)
    except FileNotFoundError:
        logger.error(
            "Publite2 isn't set up correctly. Copy %s.dist to %s and update it.",
            args.settings,
            args.settings,
        )
        return 1

    mc = MetaChecker(config=config)
    current_port = INITIAL_PORT

    for game_type in GameType:
        current_port = mc._launch_server(game_type, current_port)

    logger.info("Publite2 started!")
    mc.check(current_port)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
