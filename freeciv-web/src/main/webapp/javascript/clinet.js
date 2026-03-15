/**********************************************************************
    Freeciv-web - the web version of Freeciv. http://www.FreecivWorld.net/
    Copyright (C) 2009-2015  The Freeciv-web project

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.

***********************************************************************/


var clinet_last_send = 0;
var debug_client_speed_list = [];

var freeciv_version = "+Freeciv.Web.Devel-3.3";

var ws = null;
var civserverport = null;

var ping_last = new Date().getTime();
var pingtime_check = 240000;
var ping_timer = null;
let incomplete_messages_from_server_buffer = "";
var freecivx_server = true;

/**
 * Set to true when the freecivx-server runs in-process as a TeaVM/JavaScript
 * module rather than a remote WebSocket server.  In this mode all packets are
 * exchanged through window.freecivxSendPacket() / window.freecivxOnPacket()
 * instead of a WebSocket connection.
 */
var teavm_mode = false;

/** True while check_websocket_ready() is polling for the TeaVM server to initialise. */
var teavm_server_waiting = false;

/****************************************************************************
  Initialized the Network communication, by requesting a valid server port.
  If the URL contains ?mode=teavm the in-process TeaVM server is used instead
  of a remote WebSocket connection.
****************************************************************************/
function network_init()
{
  if ($.getUrlVar('mode') === 'teavm') {
    teavm_mode_init();
    return;
  }

  var civclient_request_url = "/civclientlauncher";
  if ($.getUrlVar('action') != null) civclient_request_url += "?action=" + $.getUrlVar('action');
  if ($.getUrlVar('action') == null && $.getUrlVar('civserverport') != null) civclient_request_url += "?";
  if ($.getUrlVar('civserverport') != null) civclient_request_url += "&civserverport=" + $.getUrlVar('civserverport');

  $.ajax({
   type: 'POST',
   url: civclient_request_url,
   success: function(data, textStatus, request){
       civserverport = request.getResponseHeader('port');
       var connect_result = request.getResponseHeader('result');
       if (civserverport != null && connect_result == "success") {
         websocket_init();
         load_game_check();

       } else {
         show_dialog_message("Network error", "Invalid server port. Error: " + connect_result);
       }
   },
   error: function (request, textStatus, errorThrown) {
	show_dialog_message("Network error", "Unable to communicate with civclientlauncher servlet . Error: "
		+ textStatus + " " + errorThrown + " " + request.getResponseHeader('result'));
   }
  });
}

/****************************************************************************
  Initialises the TeaVM in-process server mode.

  In this mode the freecivx-server runs as a compiled-to-JavaScript TeaVM
  module in the same browser tab.  Packet I/O bypasses WebSocket entirely:
  outgoing packets are forwarded through window.freecivxSendPacket() and
  incoming packets arrive via the window.freecivxOnPacket callback.

  To activate this mode load the page with ?mode=teavm in the URL and ensure
  the TeaVM JavaScript bundle (classes.js or similar) is loaded beforehand.
****************************************************************************/
function teavm_mode_init() {
    console.info("[TeaVM] Initialising in-process server mode (?mode=teavm)");
    teavm_mode = true;
    freecivx_server = true;

    // Register the callback that the TeaVM server will invoke for every
    // outgoing packet it wants to deliver to this client.
    window.freecivxOnPacket = function(packet) {
        try {
            client_handle_packet([packet]);
        } catch (e) {
            console.error("[TeaVM] freecivxOnPacket error", e);
        }
    };

    // Trigger the normal login sequence.  check_websocket_ready() will poll
    // until window.freecivxSendPacket is registered by setupBrowserApi().
    check_websocket_ready();
    load_game_check();
}

/****************************************************************************
  Starts a single-player game using the freecivx-server TeaVM bundle.

  This function is called when the user clicks the "Single Player (TeaVM)"
  button in the intro dialog.  It loads the TeaVM JavaScript bundle
  dynamically (if not already present), activates in-process packet routing,
  and begins the normal pregame login sequence so the player lands on the
  pregame screen – exactly like a standard single-player C-server game.

  Side effects: sets the global variables username, teavm_mode,
  freecivx_server, and window.freecivxOnPacket.

  @param {string} player_username  The username entered in the intro dialog.
****************************************************************************/
function start_teavm_single_player(player_username) {
    console.info("[TeaVM] start_teavm_single_player:", player_username);
    username = player_username;
    teavm_mode = true;
    freecivx_server = true;

    // Register the incoming-packet callback before the bundle is loaded so
    // that any packets dispatched during initialisation are not lost.
    window.freecivxOnPacket = function(packet) {
        try {
            client_handle_packet([packet]);
        } catch (e) {
            console.error("[TeaVM] freecivxOnPacket error", e);
        }
    };

    function on_bundle_ready() {
        // Trigger the normal login sequence (no WebSocket handshake needed).
        console.info("[TeaVM] Server ready — starting login sequence");
        check_websocket_ready();
        load_game_check();
    }

    if (typeof window.freecivxSendPacket === 'function') {
        // Bundle already loaded (e.g. page reuse); start immediately.
        console.debug("[TeaVM] Bundle already loaded, starting immediately");
        on_bundle_ready();
    } else {
        // Set the ready callback that BrowserCivServer.setupBrowserApi() will invoke
        // once the TeaVM server has finished initialising (which may be asynchronous).
        window.freecivxOnReady = function() {
            window.freecivxOnReady = null;
            on_bundle_ready();
        };

        // Dynamically load the TeaVM bundle.  The bundle's main() creates a
        // BrowserCivServer instance and calls window.freecivxOnReady when ready.
        console.info("[TeaVM] Loading /javascript/freecivx-server.js ...");
        var script = document.createElement('script');
        script.src = '/javascript/freecivx-server.js';
        script.onload = function() {
            console.debug("[TeaVM] Bundle script element loaded");
            // If TeaVM ran synchronously, freecivxOnReady was already called (and
            // cleared).  If TeaVM initialises asynchronously, the callback fires
            // later when setupBrowserApi() runs; check_websocket_ready() will also
            // poll every 50 ms as a fallback safety net.
        };
        script.onerror = function() {
            window.freecivxOnReady = null;
            console.error('[TeaVM] Failed to load bundle from /javascript/freecivx-server.js');
            show_dialog_message("Error", "The in-browser server could not be loaded. "
                + "Please try again or use the standard single-player mode.");
            teavm_mode = false;
        };
        document.head.appendChild(script);
    }
}

/****************************************************************************
  Initialized the WebSocket connection.
****************************************************************************/
function websocket_init() {

    var proxyport = parseFloat(civserverport);
    if (proxyport < 7800) {
        proxyport += 1000; // Freeciv C server with Websockify.
        freecivx_server = false;
    }
    const ws_protocol = (window.location.protocol === 'https:') ? "wss://" : "ws://";
    const port = window.location.port ? `:${window.location.port}` : '';
    ws = new WebSocket(`${ws_protocol}${window.location.hostname}${port}/civsocket/${proxyport}`);
    ws.binaryType = 'arraybuffer';

    ws.onopen = check_websocket_ready;
    ws.onmessage = handleWebSocketMessage;
    ws.onclose = handleWebSocketClose;
    ws.onerror = handleWebSocketError;
}

/****************************************************************************
 Handle message from WebSocket
****************************************************************************/
function handleWebSocketMessage(event) {
    try {
        if (event.data instanceof ArrayBuffer) {
            const data = new Uint8Array(event.data);
            const decoder = new TextDecoder('utf-8');
            const text = decoder.decode(data);

            incomplete_messages_from_server_buffer += text;

            let jsonStart = incomplete_messages_from_server_buffer.indexOf('{');
            while (jsonStart !== -1) {
                let jsonEnd = jsonStart;
                let openBraces = 1;

                // Scan for the end of the JSON object
                while (openBraces > 0 && jsonEnd + 1 < incomplete_messages_from_server_buffer.length) {
                    jsonEnd++;
                    if (incomplete_messages_from_server_buffer[jsonEnd] === '{') {
                        openBraces++;
                    } else if (incomplete_messages_from_server_buffer[jsonEnd] === '}') {
                        openBraces--;
                    }
                }

                // If we found a complete JSON object
                if (openBraces === 0) {
                    const jsonString = incomplete_messages_from_server_buffer.substring(jsonStart, jsonEnd + 1);
                    try {
                        const json = JSON.parse(jsonString);
                        client_handle_packet([json]);
                    } catch (jsonError) {
                        console.error("Error parsing JSON:", jsonError, "String:", jsonString);
                    }

                    // Move the start to the next possible JSON object
                    incomplete_messages_from_server_buffer = incomplete_messages_from_server_buffer.substring(jsonEnd + 1);
                    jsonStart = incomplete_messages_from_server_buffer.indexOf('{', 0);
                } else {
                    // Not a complete JSON yet, break and wait for more data
                    break;
                }
            }
        } else if (freecivx_server) {
            //console.log("Got packet: " + event.data);
            try {
                const json = JSON.parse(event.data);
                client_handle_packet([json]);
            } catch (jsonError) {
                console.error("Error parsing JSON:", jsonError, "String:", event.data);
            }
        } else {
            console.error("Received data of unknown type:", typeof event.data);
        }
    } catch (error) {
        console.error("Error processing packet:", error);
    }
}


function handleWebSocketClose(event) {
    swal("Network Error", "Connection to server is closed. Please reload the page to restart. Sorry!", "error");
    $("#turn_done_button, #save_button").button("option", "disabled", true);
    $(window).unbind('beforeunload');
    clearInterval(ping_timer);
    console.info("WebSocket connection closed, code+reason: " + event.code + ", " + event.reason);
}

function handleWebSocketError(evt) {
    show_dialog_message("Network error", `A problem occurred with the ${document.location.protocol} WebSocket connection to the server: ${ws.url}`);
    console.error("WebSocket error:", evt);
}

/****************************************************************************
  When the WebSocket connection is open and ready to communicate, then
  send the first login message to the server.
  In TeaVM mode the check is bypassed since there is no WebSocket.
****************************************************************************/
function check_websocket_ready()
{
  if (teavm_mode && typeof window.freecivxSendPacket !== 'function') {
    // TeaVM server not yet initialised (bundle still loading or main() pending).
    if (!teavm_server_waiting) {
      console.debug("[TeaVM] Waiting for freecivxSendPacket to be registered...");
      teavm_server_waiting = true;
    }
    setTimeout(check_websocket_ready, 50);
    return;
  }
  if (teavm_mode) {
    teavm_server_waiting = false;
  }

  if (teavm_mode || (ws != null && ws.readyState === 1)) {

    var login_message = {"pid":4, "username" : username,
    "capability": freeciv_version, "version_label": "-dev",
    "major_version" : 3, "minor_version" : 1, "patch_version" : 90};

    send_request(JSON.stringify(login_message));

    /* The connection is now up. Verify that it remains alive. */
    if (!teavm_mode) {
      ping_timer = setInterval(ping_check, pingtime_check);
    }

    $.unblockUI();
  } else {
    setTimeout(check_websocket_ready, 300);
  }
}

/****************************************************************************
  Stops network sync.
****************************************************************************/
function network_stop()
{
  if (ws != null) ws.close();
  ws = null;
}

/****************************************************************************
  Sends a request to the server, with a JSON packet.
  In TeaVM mode the packet is forwarded directly to the in-process server.
****************************************************************************/
function send_request(packet_payload) {
    if (teavm_mode) {
        if (typeof window.freecivxSendPacket === 'function') {
            console.debug("[TeaVM] send_request pid=" + JSON.parse(packet_payload).pid);
            window.freecivxSendPacket(packet_payload);
        } else {
            console.error("[TeaVM] freecivxSendPacket not available — is the TeaVM bundle loaded?");
        }
        return;
    }

    if (ws == null || ws.readyState !== WebSocket.OPEN) {
        console.error("WebSocket is not open. ReadyState:", ws ? ws.readyState : 'WebSocket not initialized');
        return;
    }

    if (freecivx_server) {
      ws.send(packet_payload);
      return;
    }

    try {
        // Convert the string payload to UTF-8 encoded bytes
        let encoder = new TextEncoder();
        let utf8_encoded = encoder.encode(packet_payload);

        // Calculate total length: 2-byte header + payload length + 1-byte null terminator
        let totalLength = 2 + utf8_encoded.length + 1;
        let buffer = new ArrayBuffer(totalLength);
        let view = new DataView(buffer);

        // Write the length of the message (header)
        view.setUint16(0, utf8_encoded.length + 3); // Automatically handles byte order

        // Insert the UTF-8 encoded bytes
        new Uint8Array(buffer).set(utf8_encoded, 2);

        // Add null terminator at the end
        view.setUint8(totalLength - 1, 0);

        // Send the complete message
        ws.send(buffer);

        // Debugging output if debug is active
        if (debug_active) {
            console.log("Sent data at:", new Date().getTime());
        }
    } catch (error) {
        console.error("Failed to send request:", error);
    }
}




/****************************************************************************
...
****************************************************************************/
function clinet_debug_collect()
{
  var time_elapsed = new Date().getTime() - clinet_last_send;
  debug_client_speed_list.push(time_elapsed);
  clinet_last_send = new Date().getTime();
}

/****************************************************************************
  Detect server disconnections, by checking the time since the last
  ping packet from the server.
****************************************************************************/
function ping_check()
{
  var time_since_last_ping = new Date().getTime() - ping_last;
  if (time_since_last_ping > pingtime_check) {
    console.log("Error: Missing PING message from server, "
                + "indicates server connection problem.");
  }
}

/****************************************************************************
  send the chat message to the server after a delay.
****************************************************************************/
function send_message_delayed(message, delay)
{
  setTimeout("send_message('" + message + "');", delay);
}

/****************************************************************************
  sends a chat message to the server.
****************************************************************************/
function send_message(message)
{

  var packet = {"pid" : packet_chat_msg_req, 
                "message" : message};
  send_request(JSON.stringify(packet));
}
