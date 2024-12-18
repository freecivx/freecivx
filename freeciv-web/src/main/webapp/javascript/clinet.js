/**********************************************************************
    Freeciv-web - the web version of Freeciv. http://www.FreecivX.net/
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
let incompleteBuffer = "";

/****************************************************************************
  Initialized the Network communication, by requesting a valid server port.
****************************************************************************/
function network_init()
{

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
  Initialized the WebSocket connection.
****************************************************************************/
function websocket_init() {
    $.blockUI({ message: "<h2>Please wait while connecting to the server.</h2>" });
    const proxyport = 1000 + parseFloat(civserverport);
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

            // Append new text to the buffer
            incompleteBuffer += text;

            let index = 0;
            let openBraces = 0;
            let jsonStart = -1;

            // Process the buffer one character at a time
            while (index < incompleteBuffer.length) {
                const char = incompleteBuffer[index];

                if (char === '{') {
                    // Mark the start of a JSON object
                    if (openBraces === 0) {
                        jsonStart = index;
                    }
                    openBraces++;
                } else if (char === '}') {
                    openBraces--;

                    // If we closed all braces, a JSON object is complete
                    if (openBraces === 0 && jsonStart !== -1) {
                        const jsonString = incompleteBuffer.slice(jsonStart, index + 1)
                            .replace(/[^ -~\s]/g, ''); // Strip non-printable ASCII characters

                        try {
                            const json = JSON.parse(jsonString);
                            client_handle_packet([json]); // Pass parsed JSON to the handler
                        } catch (jsonError) {
                            console.error("Error parsing JSON:", jsonError, "String:", jsonString);
                        }

                        // Remove the processed JSON from the buffer
                        incompleteBuffer = incompleteBuffer.slice(index + 1);
                        index = 0; // Reset the index for the new buffer
                        jsonStart = -1; // Reset JSON start marker
                        continue;
                    }
                }

                index++;
            }

            // Clean up the buffer if it only contains garbage without valid JSON
            if (openBraces === 0 && jsonStart === -1) {
                incompleteBuffer = "";
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
****************************************************************************/
function check_websocket_ready()
{
  if (ws != null && ws.readyState === 1) {

    var login_message = {"pid":4, "username" : username,
    "capability": freeciv_version, "version_label": "-dev",
    "major_version" : 3, "minor_version" : 1, "patch_version" : 90};

    send_request(JSON.stringify(login_message));

    /* The connection is now up. Verify that it remains alive. */
    ping_timer = setInterval(ping_check, pingtime_check);

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
****************************************************************************/
function send_request(packet_payload) {
    if (ws == null || ws.readyState !== WebSocket.OPEN) {
        console.error("WebSocket is not open. ReadyState:", ws ? ws.readyState : 'WebSocket not initialized');
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
