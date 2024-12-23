#!/usr/bin/env python3
"""
Publite2: A process manager to launch multiple Freeciv-web servers.
"""

import sys
import time
import http.client
import configparser
from enum import Enum
from pathlib import Path
from pubstatus import PubStatus
from civlauncher import Civlauncher

# Constants
METAHOST = "localhost"
METAPORT = 8080
METAPATH = "/freeciv-web/meta/metaserver"
STATUSPATH = "/freeciv-web/meta/status"
SETTINGS_FILE = "settings.ini"
METACHECKER_INTERVAL = 40
INITIAL_PORT = 6000


class GameType(Enum):
    SINGLEPLAYER = "singleplayer"
    MULTIPLAYER = "multiplayer"


class MetaChecker:
    def __init__(self):
        self.server_list = []
        self.check_count = 0
        self.total = 0
        self.single = 0
        self.multi = 0
        self.last_http_status = -1
        self.html_doc = "-"

        self._load_settings()
        self._start_pubstatus()

    def _load_settings(self):
        """Load settings from the configuration file."""
        if not Path(SETTINGS_FILE).is_file():
            print(
                f"ERROR: Publite2 isn't set up correctly. "
                f"Copy {SETTINGS_FILE}.dist to {SETTINGS_FILE} and update it."
            )
            sys.exit(1)

        settings = configparser.ConfigParser()
        settings.read(SETTINGS_FILE)

        self.server_capacity_single = int(settings.get("Resource usage", "server_capacity_single", fallback=5))
        self.server_capacity_multi = int(settings.get("Resource usage", "server_capacity_multi", fallback=2))
        self.server_limit = int(settings.get("Resource usage", "server_limit", fallback=250))
        self.savesdir = settings.get("Config", "save_directory", fallback="/var/lib/tomcat11/webapps/data/savegames/")

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
            else:
                print(f"Error: Invalid metaserver status (HTTP {response.status})")
                return None
        except Exception as e:
            print(f"Error: Unable to connect to metaserver at http://{METAHOST}{STATUSPATH}. Error: {e}")
            return None
        finally:
            conn.close()

    def _launch_server(self, game_type: GameType, port: int) -> int:
        """Launch a new server for the specified game type."""
        print(f"Launching {game_type.value} server on port {port}")
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


if __name__ == "__main__":
    # Test connection to the metaserver
    try:
        conn = http.client.HTTPConnection(METAHOST, METAPORT)
        conn.request("GET", STATUSPATH)
        response = conn.getresponse()

        if response.status != 200:
            print(f"Error: Invalid response from metaserver (HTTP {response.status})")
            sys.exit(1)
    except Exception as e:
        print(f"Error: Unable to connect to metaserver at http://{METAHOST}{METAPATH}. Error: {e}")
        sys.exit(1)
    finally:
        conn.close()

    # Start the initial servers
    mc = MetaChecker()
    current_port = INITIAL_PORT

    for game_type in GameType:
        current_port = mc._launch_server(game_type, current_port)

    print("Publite2 started!")
    mc.check(current_port)
 
