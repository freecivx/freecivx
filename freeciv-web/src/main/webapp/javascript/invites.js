/**********************************************************************
 FreecivX.net - the web version of Freeciv. https://www.FreecivX.net/
 Copyright (C) 2025 FreecivX.net

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


var shownInvites = new Set();

function checkInvitations() {
    if ($.getUrlVar('invite') == "true") {
        return;
    }

    var stored_username = simpleStorage.get("username", "");
    if (stored_username != null ) {
        username = stored_username;
    }
    if (username == null) return;

    $.ajax({
        url: "/PlayerMatcher?username=" + username,
        method: "GET",
        dataType: "json",
        success: function (data) {
            if (data.invitations && data.invitations.length > 0) {
                data.invitations.forEach(invite => {
                    let inviteKey = `${invite.from}-${invite.port}`; // Unique key for each invite

                    if (!shownInvites.has(inviteKey)) {
                        shownInvites.add(inviteKey); // Mark as shown
                        showInviteDialog(invite.from, invite.port);
                    }
                });
            }
        },
        error: function () {
            console.error("Error fetching invitations.");
        }
    });
}

function showInviteDialog(from, port) {
    let dialogId = `inviteDialog-${from}-${port}`; // Unique ID for each dialog
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
