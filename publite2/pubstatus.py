from threading import Thread
from tornado import web, ioloop, httpserver
import sys
import logging

STATUS_PORT = 4002

logger = logging.getLogger(__name__)

"""Serves the Publite2 status page on the URL: /pubstatus"""
class PubStatus(Thread):
    def __init__(self, mc):
        super().__init__()
        self.metachecker = mc

    def run(self):
        # Log the Python version
        logger.info("Starting PubStatus server with Python version: %s", sys.version)

        # Set up the Tornado IOLoop and application
        io_loop = ioloop.IOLoop()
        io_loop.make_current()
        application = web.Application([
            (r"/pubstatus", StatusHandler, dict(metachecker=self.metachecker)),
        ])
        http_server = httpserver.HTTPServer(application)
        http_server.listen(STATUS_PORT)
        io_loop.start()

class StatusHandler(web.RequestHandler):
    def initialize(self, metachecker):
        self.metachecker = metachecker

    def get(self):
        game_count = sum(server.num_start for server in self.metachecker.server_list)
        error_count = sum(server.num_error for server in self.metachecker.server_list)
        error_rate = (error_count * 100 / game_count) if game_count > 0 else 0

        # Write the status page HTML
        self.write(f"""
        <html>
        <head>
            <title>Publite2 status for Freecivx</title>
            <link href='/css/bootstrap.min.css' rel='stylesheet'>
            <meta http-equiv="refresh" content="20">
            <style>td {{ padding: 2px; }}</style>
        </head>
        <body>
            <div class='container'>
                <h2>FreecivX Publite2 Status</h2>
                <table>
                    <tr><td>Number of Freeciv-web games run:</td><td>{game_count}</td></tr>
                    <tr><td>Server limit (maximum number of running servers):</td><td>{self.metachecker.server_limit}</td></tr>
                    <tr><td>Server capacity:</td><td>{self.metachecker.server_capacity_single}, {self.metachecker.server_capacity_multi}</td></tr>
                    <tr><td>Number of servers running according to Publite2:</td><td>{len(self.metachecker.server_list)}</td></tr>
                    <tr><td>Number of servers running according to metaserver:</td><td>{self.metachecker.total}</td></tr>
                    <tr><td>Available single-player pregame servers on metaserver:</td><td>{self.metachecker.single}</td></tr>
                    <tr><td>Available multi-player pregame servers on metaserver:</td><td>{self.metachecker.multi}</td></tr>
                    <tr><td>Number of HTTP checks against metaserver:</td><td>{self.metachecker.check_count}</td></tr>
                    <tr><td>Last response from metaserver:</td><td>{self.metachecker.html_doc}</td></tr>
                    <tr><td>Last HTTP status from metaserver:</td><td>{self.metachecker.last_http_status}</td></tr>
                    <tr><td>Number of Freeciv servers stopped by error:</td><td>{error_count} ({error_rate:.2f}%)</td></tr>
                </table>
                <h3>Running Freeciv-web servers:</h3>
                <table>
                    <tr>
                        <td>Server Port</td><td>Type</td><td>Started Time</td><td>Restarts</td><td>Errors</td>
                    </tr>
        """)

        # Add server details
        for server in self.metachecker.server_list:
            self.write(f"""
                <tr>
                    <td><a href='/civsocket/{server.new_port + 1000}/status'>{server.new_port}</a></td>
                    <td>{server.gametype}</td>
                    <td>{server.started_time}</td>
                    <td>{server.num_start}</td>
                    <td>{server.num_error}</td>
                </tr>
            """)

        self.write("""
                </table>
            </div>
        </body>
        </html>
        """)
