from __future__ import annotations

"""Configuration loading for publite2.

This wraps the legacy settings.ini format in a typed object so the rest of
publite2 can use standard patterns without changing external behaviour.
"""

from dataclasses import dataclass
from pathlib import Path
import configparser
import os


DEFAULT_SETTINGS_FILE = "settings.ini"


@dataclass
class PubliteConfig:
    server_capacity_single: int
    server_capacity_multi: int
    server_limit: int
    savesdir: str
    metahost: str = "localhost"
    metaport: int = 8080
    status_port: int = 4002
    initial_port: int = 6000
    check_interval: int = 40


def load_config(settings_path: str | Path = DEFAULT_SETTINGS_FILE) -> PubliteConfig:
    """Load configuration from an INI file.

    This preserves the current behaviour of MetaChecker._load_settings while
    providing a reusable, testable function.
    
    Configuration can be overridden with environment variables:
    - PUBLITE_METAHOST
    - PUBLITE_METAPORT
    - PUBLITE_STATUS_PORT
    - PUBLITE_INITIAL_PORT
    - PUBLITE_CHECK_INTERVAL
    """
    path = Path(settings_path)
    if not path.is_file():
        raise FileNotFoundError(
            f"Publite2 isn't set up correctly. Copy {path.name}.dist to {path.name} and update it."
        )

    parser = configparser.ConfigParser()
    parser.read(path)

    server_capacity_single = int(
        parser.get("Resource usage", "server_capacity_single", fallback="5")
    )
    server_capacity_multi = int(
        parser.get("Resource usage", "server_capacity_multi", fallback="2")
    )
    server_limit = int(parser.get("Resource usage", "server_limit", fallback="250"))
    savesdir = parser.get(
        "Config",
        "save_directory",
        fallback="/var/lib/tomcat11/webapps/data/savegames/",
    )
    
    # Allow configuration override via environment variables
    metahost = os.environ.get("PUBLITE_METAHOST", parser.get("Config", "metahost", fallback="localhost"))
    metaport = int(os.environ.get("PUBLITE_METAPORT", parser.get("Config", "metaport", fallback="8080")))
    status_port = int(os.environ.get("PUBLITE_STATUS_PORT", parser.get("Config", "status_port", fallback="4002")))
    initial_port = int(os.environ.get("PUBLITE_INITIAL_PORT", parser.get("Config", "initial_port", fallback="6000")))
    check_interval = int(os.environ.get("PUBLITE_CHECK_INTERVAL", parser.get("Config", "check_interval", fallback="40")))

    return PubliteConfig(
        server_capacity_single=server_capacity_single,
        server_capacity_multi=server_capacity_multi,
        server_limit=server_limit,
        savesdir=savesdir,
        metahost=metahost,
        metaport=metaport,
        status_port=status_port,
        initial_port=initial_port,
        check_interval=check_interval,
    )

