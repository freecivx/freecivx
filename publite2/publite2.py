#!/usr/bin/env python3
"""
Publite2: A process manager to launch multiple Freeciv-web servers.
"""

import sys
import time
import http.client
import logging
import argparse
import threading
import signal
from enum import Enum
from pathlib import Path
from pubstatus import PubStatus
from civlauncher import Civlauncher
from config import PubliteConfig, load_config

# Constants - can be overridden via config
METAPATH = "/freeciv-web/meta/metaserver"
STATUSPATH = "/freeciv-web/meta/status"
SETTINGS_FILE = "settings.ini"


logger = logging.getLogger(__name__)


class GameType(Enum):
    SINGLEPLAYER = "singleplayer"
    MULTIPLAYER = "multiplayer"


class MetaChecker:
    def __init__(self, config: PubliteConfig | None = None):
        self.server_list = []
        self.server_list_lock = threading.Lock()
        self.check_count = 0
        self.total = 0
        self.single = 0
        self.multi = 0
        self.last_http_status = -1
        self.html_doc = "-"
        self.shutdown_event = threading.Event()

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
        self.metahost = config.metahost
        self.metaport = config.metaport
        self.check_interval = config.check_interval

        self._start_pubstatus()

    def _start_pubstatus(self):
        """Start the PubStatus thread."""
        pub_status = PubStatus(self)
        pub_status.start()

    def _fetch_meta_status(self):
        """Fetch the meta status from the Freeciv-web metaserver."""
        conn = None
        try:
            conn = http.client.HTTPConnection(self.metahost, self.metaport, timeout=10)
            conn.request("GET", STATUSPATH)
            response = conn.getresponse()

            self.last_http_status = response.status
            if response.status == 200:
                self.html_doc = response.read().decode("ascii")
                status_parts = self.html_doc.split(";")
                # Validate response format before returning
                if len(status_parts) != 4:
                    logger.error(
                        "Invalid metaserver status format. Expected 4 parts, got %d: %s",
                        len(status_parts),
                        self.html_doc,
                    )
                    return None
                return status_parts
            logger.error("Invalid metaserver status (HTTP %s)", response.status)
            return None
        except (OSError, http.client.HTTPException) as e:
            logger.error(
                "Unable to connect to metaserver at http://%s:%s%s. Error: %s",
                self.metahost,
                self.metaport,
                STATUSPATH,
                e,
            )
            return None
        finally:
            if conn:
                conn.close()

    def _launch_server(self, game_type: GameType, port: int) -> int:
        """Launch a new server for the specified game type."""
        logger.info("Launching %s server on port %s", game_type.value, port)
        new_server = Civlauncher(
            game_type.value,
            game_type.value,
            port,
            f"{self.metahost}:{self.metaport}{METAPATH}",
            self.savesdir,
            self.shutdown_event,
        )
        with self.server_list_lock:
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
        while not self.shutdown_event.is_set():
            self.shutdown_event.wait(self.check_interval)
            if self.shutdown_event.is_set():
                break
            
            self.check_count += 1

            meta_status = self._fetch_meta_status()
            if not meta_status:
                continue

            self._update_counts(meta_status)

            while self.single < self.server_capacity_single and self.total < self.server_limit:
                if self.shutdown_event.is_set():
                    break
                port = self._launch_server(GameType.SINGLEPLAYER, port)
                self.single += 1
                self.total += 1

            while self.multi < self.server_capacity_multi and self.total < self.server_limit:
                if self.shutdown_event.is_set():
                    break
                port = self._launch_server(GameType.MULTIPLAYER, port)
                self.multi += 1
                self.total += 1
        
        logger.info("MetaChecker check loop shutting down gracefully.")


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

    # Load configuration first to get connection parameters
    try:
        config = load_config(args.settings)
    except FileNotFoundError:
        logger.error(
            "Publite2 isn't set up correctly. Copy %s.dist to %s and update it.",
            args.settings,
            args.settings,
        )
        return 1

    # Test connection to the metaserver (legacy behaviour).
    conn = None
    try:
        conn = http.client.HTTPConnection(config.metahost, config.metaport, timeout=10)
        conn.request("GET", STATUSPATH)
        response = conn.getresponse()

        if response.status != 200:
            logger.error("Invalid response from metaserver (HTTP %s)", response.status)
            return 1
    except (OSError, http.client.HTTPException) as e:
        logger.error(
            "Unable to connect to metaserver at http://%s:%s%s. Error: %s",
            config.metahost,
            config.metaport,
            METAPATH,
            e,
        )
        return 1
    finally:
        if conn:
            conn.close()

    mc = MetaChecker(config=config)
    
    # Set up signal handlers for graceful shutdown
    def signal_handler(signum, frame):
        signal_name = signal.Signals(signum).name
        logger.info("Received signal %s, initiating graceful shutdown...", signal_name)
        mc.shutdown_event.set()
    
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)
    
    current_port = config.initial_port

    for game_type in GameType:
        current_port = mc._launch_server(game_type, current_port)

    logger.info("Publite2 started!")
    try:
        mc.check(current_port)
    except KeyboardInterrupt:
        logger.info("Keyboard interrupt received, shutting down...")
        mc.shutdown_event.set()
    
    logger.info("Publite2 shutdown complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
