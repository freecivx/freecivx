from __future__ import annotations

"""Configuration loading for publite2.

This wraps the legacy settings.ini format in a typed object so the rest of
publite2 can use standard patterns without changing external behaviour.
"""

from dataclasses import dataclass
from pathlib import Path
import configparser


DEFAULT_SETTINGS_FILE = "settings.ini"


@dataclass
class PubliteConfig:
    server_capacity_single: int
    server_capacity_multi: int
    server_limit: int
    savesdir: str


def load_config(settings_path: str | Path = DEFAULT_SETTINGS_FILE) -> PubliteConfig:
    """Load configuration from an INI file.

    This preserves the current behaviour of MetaChecker._load_settings while
    providing a reusable, testable function.
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

    return PubliteConfig(
        server_capacity_single=server_capacity_single,
        server_capacity_multi=server_capacity_multi,
        server_limit=server_limit,
        savesdir=savesdir,
    )

