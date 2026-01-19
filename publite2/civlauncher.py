import subprocess
import time
import pwd
import os
import threading
from threading import Thread
from pathlib import Path
from datetime import datetime
import logging


logger = logging.getLogger(__name__)


class Civlauncher(Thread):
    def __init__(self, gametype, scripttype, new_port, metahostpath, savesdir, shutdown_event=None):
        super().__init__()
        self.daemon = True  # Thread will not prevent program exit
        self.new_port = new_port
        self.gametype = gametype
        self.scripttype = scripttype
        self.metahostpath = metahostpath
        self.savesdir = Path(savesdir)
        self.started_time = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        self.num_start = 0
        self.num_error = 0
        self.shutdown_event = shutdown_event or threading.Event()

    def run(self):
        while not self.shutdown_event.is_set():
            try:
                logger.info(
                    "Start freeciv-web on port %s and freeciv-proxy on port %s.",
                    self.new_port,
                    1000 + self.new_port,
                )
                self.launch_game()
                self.num_start += 1
            except (OSError, subprocess.SubprocessError, ValueError) as e:
                logger.error("Error during execution: %s", e)
                self.num_error += 1
            except KeyboardInterrupt:
                logger.info("Received keyboard interrupt, stopping server on port %s.", self.new_port)
                break
            
            # Check shutdown event before sleeping
            if self.shutdown_event.wait(5):
                break
        
        logger.info("Civlauncher thread for port %s shutting down.", self.new_port)

    def launch_game(self):
        # Prepare save directory
        self.savesdir.mkdir(parents=True, exist_ok=True)

        # Build arguments
        args = self.build_freeciv_args()

        # Use absolute path for logs directory
        script_dir = Path(__file__).parent.resolve()
        logs_dir = script_dir.parent / "logs"
        logs_dir.mkdir(parents=True, exist_ok=True)

        proxy_process = None
        try:
            # Start proxy process with proper file handle management
            proxy_log = logs_dir / f"freeciv-proxy-{1000 + self.new_port}.log"
            with open(proxy_log, "w") as proxy_log_file:
                proxy_process = subprocess.Popen(
                    ["websockify", str(1000 + self.new_port), f"localhost:{self.new_port}"],
                    stdout=proxy_log_file,
                    stderr=subprocess.STDOUT,
                )
            logger.info("Proxy started on port %s.", 1000 + self.new_port)

            # Start Freeciv-web process with proper file handle management
            freeciv_log = logs_dir / f"freeciv-web-stderr-{self.new_port}.log"
            with open(freeciv_log, "w") as freeciv_log_file:
                freeciv_process = subprocess.Popen(
                    args,
                    stdout=subprocess.DEVNULL,
                    stderr=freeciv_log_file,
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
        
        # Validate metahostpath to prevent command injection
        # Allow only alphanumeric, dots, colons, slashes, and dashes
        import re
        if not re.match(r'^[a-zA-Z0-9.:/_-]+$', self.metahostpath):
            logger.error(
                "Invalid metahostpath format: %s. Must contain only alphanumeric, dots, colons, slashes, and dashes.",
                self.metahostpath,
            )
            raise ValueError(f"Invalid metahostpath: {self.metahostpath}")
        
        # Use absolute path for logs directory
        script_dir = Path(__file__).parent.resolve()
        logs_dir = script_dir.parent / "logs"
        log_file = logs_dir / f"freeciv-web-log-{self.new_port}.log"
        
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
            "--log", str(log_file),
            "--quitidle", "20",
            "--saves", str(self.savesdir),
        ]
        return args
