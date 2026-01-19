import subprocess
import time
import pwd
import os
from threading import Thread
from pathlib import Path
from datetime import datetime
import logging


logger = logging.getLogger(__name__)


class Civlauncher(Thread):
    def __init__(self, gametype, scripttype, new_port, metahostpath, savesdir):
        super().__init__()
        self.new_port = new_port
        self.gametype = gametype
        self.scripttype = scripttype
        self.metahostpath = metahostpath
        self.savesdir = Path(savesdir)
        self.started_time = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        self.num_start = 0
        self.num_error = 0

    def run(self):
        while True:
            try:
                logger.info(
                    "Start freeciv-web on port %s and freeciv-proxy on port %s.",
                    self.new_port,
                    1000 + self.new_port,
                )
                self.launch_game()
                self.num_start += 1
            except Exception as e:  # noqa: BLE001
                logger.error("Error during execution: %s", e)
                self.num_error += 1
            time.sleep(5)

    def launch_game(self):
        # Prepare save directory
        self.savesdir.mkdir(parents=True, exist_ok=True)

        # Build arguments
        args = self.build_freeciv_args()

        proxy_process = None
        try:
            # Start proxy process
            proxy_log = f"../logs/freeciv-proxy-{1000 + self.new_port}.log"
            proxy_process = subprocess.Popen(
                ["websockify", str(1000 + self.new_port), f"localhost:{self.new_port}"],
                stdout=open(proxy_log, "w"),
                stderr=subprocess.STDOUT,
            )
            logger.info("Proxy started on port %s.", 1000 + self.new_port)

            # Start Freeciv-web process
            freeciv_log = f"../logs/freeciv-web-stderr-{self.new_port}.log"
            freeciv_process = subprocess.Popen(
                args,
                stdout=subprocess.DEVNULL,
                stderr=open(freeciv_log, "w"),
            )
            freeciv_process.wait()
            logger.info("Freeciv-web process exited with code %s.", freeciv_process.returncode)

        finally:
            if proxy_process:
                proxy_process.terminate()
                proxy_process.wait()
                logger.info("Proxy process terminated.")

    def build_freeciv_args(self):
        # Get home directory from system user database (not from HOME env var)
        # This prevents command injection via HOME environment variable manipulation
        home_dir = Path(pwd.getpwuid(os.getuid()).pw_dir)
        freeciv_binary = home_dir / "freeciv" / "bin" / "freeciv-web"
        
        # Resolve to absolute path and validate it exists
        try:
            freeciv_binary = freeciv_binary.resolve(strict=True)
        except (OSError, FileNotFoundError) as e:
            logger.error(
                "Freeciv binary not found. Expected location: %s. Error: %s",
                freeciv_binary,
                e,
            )
            raise
        
        args = [
            str(freeciv_binary),
            "--debug", "1",
            "--port", str(self.new_port),
            "--Announce", "none",
            "--exit-on-end",
            "--meta", "--keep",
            "--Metaserver", f"http://{self.metahostpath}",
            "--type", self.gametype,
            "--read", f"pubscript_{self.scripttype}.serv",
            "--log", f"../logs/freeciv-web-log-{self.new_port}.log",
            "--quitidle", "20",
            "--saves", str(self.savesdir),
        ]
        return args
