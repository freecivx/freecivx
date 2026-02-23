import subprocess
import time
import pwd
import os
import threading
import re
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

        # Set up environment with library path
        home_dir = Path(pwd.getpwuid(os.getuid()).pw_dir)
        env = os.environ.copy()
        lib_path = str(home_dir / "freeciv" / "lib")
        existing = env.get('LD_LIBRARY_PATH', '')
        env['LD_LIBRARY_PATH'] = f"{lib_path}:{existing}" if existing else lib_path

        proxy_process = None
        proxy_log_file = None
        freeciv_log_file = None
        
        try:
            # Start proxy process - keep file handle open for process lifetime
            proxy_log = logs_dir / f"freeciv-proxy-{1000 + self.new_port}.log"
            proxy_log_file = open(proxy_log, "w")
            proxy_process = subprocess.Popen(
                ["websockify", str(1000 + self.new_port), f"localhost:{self.new_port}"],
                stdout=proxy_log_file,
                stderr=subprocess.STDOUT,
            )
            logger.info("Proxy started on port %s.", 1000 + self.new_port)

            # Start Freeciv-web process - keep file handle open for process lifetime
            freeciv_log = logs_dir / f"freeciv-web-stderr-{self.new_port}.log"
            freeciv_log_file = open(freeciv_log, "w")
            freeciv_process = subprocess.Popen(
                args,
                env=env,
                stdout=subprocess.DEVNULL,
                stderr=freeciv_log_file,
            )
            freeciv_process.wait()
            logger.info("Freeciv-web process exited with code %s.", freeciv_process.returncode)

        finally:
            # Clean up proxy process
            if proxy_process:
                proxy_process.terminate()
                proxy_process.wait()
                logger.info("Proxy process terminated.")
            
            # Close file handles after processes are done
            if proxy_log_file:
                proxy_log_file.close()
            if freeciv_log_file:
                freeciv_log_file.close()

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
