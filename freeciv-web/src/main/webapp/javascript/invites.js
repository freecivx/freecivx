/**********************************************************************
 FreecivWorld.net - the web version of Freeciv. https://www.FreecivWorld.net/
 Copyright (C) 2025 FreecivWorld.net

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


const shownInvites = new Set();

/**************************************************************************
 Invite player to multiplayer game
 **************************************************************************/
async function show_invite_player_dialog()
{
    const message = "<div id=\"invite_dialog\" title=\"Invite Player\">\n" +
        "    <p>Select a player to invite (online last 12 hours):</p>\n" +
        "    <select id=\"playerList\"></select>\n" +
        "</div><br>" ;

    // reset dialog page.
    $("#invite_dialog").remove();
    $("<div id='invite_dialog'></div>").appendTo("div#game_page");

    $("#invite_dialog").html(message);

    $("#invite_dialog").dialog({
        bgiframe: true,
        modal: true,
        width: 400,
        buttons: {
            "Invite Player": async function() {
                const selectedPlayer = $("#playerList").val();
                if (!selectedPlayer) {
                    alert("Please select a player.");
                    return;
                }

                // Send invite request
                try {
                    await fetch("/PlayerMatcher?from=" + encodeURIComponent(username)
                        + "&to=" + encodeURIComponent(selectedPlayer)
                        + "&port=" + encodeURIComponent(civserverport));
                    alert("Player invited successfully!");
                    $("#invite_dialog").dialog("close");
                } catch (err) {
                    alert("Error sending invite.");
                }
            },
            "Cancel": function() {
                $(this).dialog("close");
            }
        }
    });

    try {
        const response = await fetch("/player/onlinelist");
        const data = await response.json();
        const playerList = document.getElementById("playerList");
        playerList.innerHTML = "";
        data.players.forEach(player => {
            if (player.toLowerCase() !== username.toLowerCase()) {
                const option = document.createElement("option");
                option.value = player;
                option.textContent = player;
                playerList.appendChild(option);
            }
        });

        // Open the dialog after loading data
        $("#invite_dialog").dialog("open");
    } catch (err) {
        alert("Error fetching player list.");
    }
}



async function checkInvitations() {
    if (new URLSearchParams(window.location.search).get('invite') === "true") {
        return;
    }

    const stored_username = simpleStorage.get("username", "");
    if (stored_username != null ) {
        username = stored_username;
    }
    if (username == null) return;

    try {
        const response = await fetch("/PlayerMatcher?username=" + encodeURIComponent(username));
        const data = await response.json();
        if (data.invitations && data.invitations.length > 0) {
            data.invitations.forEach(invite => {
                const inviteKey = `${invite.from}-${invite.port}`; // Unique key for each invite

                if (!shownInvites.has(inviteKey)) {
                    shownInvites.add(inviteKey); // Mark as shown
                    showInviteDialog(invite.from, invite.port);
                }
            });
        }
    } catch (err) {
        console.error("Error fetching invitations.");
    }
}

function showInviteDialog(from, port) {
    const dialogId = `inviteDialog-${from}-${port}`; // Unique ID for each dialog
    if ($(`#${dialogId}`).length > 0) return; // Prevent duplicate dialogs

    // Create dialog HTML
    let dialogHtml = `
            <div id="${dialogId}" title="Game Invitation">
                <p><b>${from} has invited you to a multiplayer game on server port:${port}.</b></p>
            </div>
        `;

    $("body").append(dialogHtml); // Add dialog to the page

    // Initialize jQuery UI dialog
    $(`#${dialogId}`).dialog({
        modal: false,
        width: 600,
        height: 170,
        position: { my: "center bottom", at: "center bottom", of: window },
        open: function () {
            $(".ui-dialog").css("z-index", 9999);
        },
        buttons: {
            "Accept Invite": function () {
                window.location.href = `/webclient/?action=multi&civserverport=${port}&multi=true&type=multiplayer&invite=true`;
            },
            "Cancel": function () {
                $(this).dialog("close").remove();

            }
        }
    });
}
