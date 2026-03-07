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

let saved_this_turn = false;
let game_loaded = false;

const scenarios = [
  {"img":"/images/world_small.png", "description":"The World - Small world map, 80x50 map of the Earth", "savegame":"earth-small"},
  {"img":"/images/world_big.png", "description":"The World - Large world map, 160x90 map of the Earth", "savegame":"earth-large"},
  {"img":"/images/iberian.png", "description":"Iberian Peninsula - 136x100 map of Spain and Portugal", "savegame":"iberian-peninsula"},
  {"img":"/images/france.png", "description":"France - Large (140x90)", "savegame":"france"},
  {"img":"/images/japan.png", "description":"Japan - Medium (88x100)", "savegame":"japan"},
  {"img":"/images/italy.png", "description":"Italy - Medium (100x100)", "savegame":"italy"},
  {"img":"/images/america.png", "description":"North America - 116x100 map of North America", "savegame":"north_america"},
  {"img":"/images/british.png", "description":"British Aisles - Medium (85x80)", "savegame":"british-isles"},
  {"img":"/images/hagworld.png", "description":"The World - Classic-style 120x60 map of the Earth", "savegame":"hagworld"},
  {"img":"/images/europe.png", "description":"Very large map of Europe, 200x100", "savegame":"europe"}
];

let scenario_info = null;
let scenario_activated = false;
let loadTimerId = -1;


/****************************************************************************
  Shows the save game dialog.
****************************************************************************/
function save_game()
{

  if (saved_this_turn) {
    swal("You have already saved this turn, and you can only save once every turn each game-session.");
    return;
  }
  // reset dialog page.
  $("#save_dialog").remove();
  $("<div id='save_dialog'></div>").appendTo("div#game_page");

  let dhtml = "<span id='settings_info'><i>You can save your current game here. "
    + "Savegames are stored on the server. You can save once every turn in each game session.</i></span>";

  if (!logged_in_with_password) {
    dhtml += "<br><br>Warning: You have not logged in using a user account with password. Please "
    + "create a new user account with password next time you want save, so you are sure"
    + " you can load the savegame with a username and password. <a href='/webclient/?action=new&amp;type=singleplayer'>Click here</a> "
    + "to start a new game, then click on the \"New User Account\" button to create a new account.<br>";
  }

  $("#save_dialog").html(dhtml);
  $("#save_dialog").attr("title", "Save game");
  $("#save_dialog").dialog({
		bgiframe: true,
		modal: true,
		width: "65%",
		buttons: [
			{
				text: "Save Game",
				click: function() {
					$("#save_dialog").dialog('close');
					send_message("/save");
					swal("Game saved.");
				},
				icon: "ui-icon-disk"
			}
		]
		});

  $("#save_dialog").dialog('open');
  saved_this_turn = true;
}

/**************************************************************************
 Press Ctrl-S to quickly save the game.
**************************************************************************/
function quicksave()
{

  if (saved_this_turn) {
    swal("You have already saved this turn, and you can only save once every turn each game-session.");
    return;
  }

  send_message("/save");
  message_log.update({
    event: E_SCRIPT,
    message: "Game saved."
  });
  saved_this_turn = true;

}



/**************************************************************************
 Prepare Load game dialog
**************************************************************************/
async function show_load_game_dialog()
{
 if (userid == null) {
   show_scenario_dialog();
 } else {
   try {
     const response = await fetch("/listsavegames?username=" + encodeURIComponent(username) + "&userid=" + userid, { method: 'POST' });
     const data = await response.text();
     show_load_game_dialog_cb(data);
   } catch (err) {
     swal("Loading game failed (listsavegames failed)");
   }
 }
}

/**************************************************************************
 Show Load game dialog
**************************************************************************/
function show_load_game_dialog_cb(savegames_data)
{
  const saveItems = [];

  if (savegames_data != null && savegames_data.length >= 3) {
    const savegames = savegames_data.split(";");
    for (let i = 0; i < savegames.length; i++) {
        if (savegames[i].length > 2) {
          saveItems.push("<li class='ui-widget-content'>" + savegames[i] + "</li>");
        }
    }
  }

  if (saveItems.length == 0) {
    show_scenario_dialog();
    return;
  }

  const saveHtml = "<ul id='selectable' style='height: 95%;'>" + saveItems.join('')
           + "</ul><br>";


  const dialog_buttons = [];

  if (C_S_RUNNING != client_state()) {
    dialog_buttons.push({
      text: "Load Savegame",
      click: function() {
  const load_game_id = $('#selectable .ui-selected').index();
  if (load_game_id === -1) {
    swal("Unable to load savegame: no game selected.");
  } else if ($('#selectable .ui-selected').text() != null){
            send_message("/load " + $('#selectable .ui-selected').text());
            game_loaded = true;

    $("#dialog").dialog('close');
    $("#game_text_input").blur();
  }
      },
      icon: "ui-icon-folder-open"
    });
    const stored_password = simpleStorage.get("password", "");
    if (stored_password != null && stored_password != false) {
      dialog_buttons.push({
        text: "Delete ALL",
        click: function() {
            let r;
            if ('confirm' in window) {
             r = confirm("Do you really want to delete all your savegames?");
            } else {
             r = true;
            }
            if (r == true) {
              delete_all_savegames();
      $("#dialog").dialog('close');
      setTimeout(show_scenario_dialog, 1000);
    }
        },
        icon: "ui-icon-trash"
      });
      
      dialog_buttons.push({
        text: "Delete",
        click: function() {
          const load_game_id = $('#selectable .ui-selected').index();
          if (load_game_id !== -1) {
          $('#selectable .ui-selected').each(function () {
             const $this = $(this);
             if ($this.length) {
              delete_savegame($this.text());
             }
          });
          }
          $('#selectable .ui-selected').remove();
        },
        icon: "ui-icon-trash"
      });
    }
    dialog_buttons.push({
      text: "Load Scenarios...",
      click: function() {
  $("#dialog").dialog('close');
  $("#game_text_input").blur();
  show_scenario_dialog();
      },
      icon: "ui-icon-script"
    });
  }



  // reset dialog page.
  $("#dialog").remove();
  $("<div id='dialog'></div>").appendTo("div#game_page");

  $("#dialog").html(saveHtml);
  $("#dialog").attr("title", "Resume playing a saved game");
  $("#dialog").dialog({
			bgiframe: true,
			modal: true,
			width: "70%",
			height: $(window).height() - 60,
			buttons: dialog_buttons
		});

  $("#selectable li").first().addClass('ui-selected');

  if (!is_touch_device()) {
    $("#selectable").selectable();
  } else {
    $("#selectable").on("click", "li", function (ev) {
      ev.stopPropagation();
      const item = $(this);
      item.siblings().removeClass('ui-selected');
      item.addClass('ui-selected');
    });
  }

  $("#dialog").dialog('open');
  $("#game_text_input").blur();


  $('.ui-dialog-buttonpane button').eq(0).focus();

}

/**************************************************************************
 Deletes a savegame
**************************************************************************/
function delete_savegame(filename)
{
  const stored_password = simpleStorage.get("password", "");
  if (stored_password != null && stored_password != false) {
    const shaObj = new jsSHA("SHA-512", "TEXT");
    shaObj.update(stored_password);
    const sha_password = encodeURIComponent(shaObj.getHash("HEX"));

    fetch("/deletesavegame?username=" + encodeURIComponent(username) + "&savegame=" + encodeURIComponent(filename)
     + "&sha_password=" + sha_password + "&userid=" + userid, { method: 'POST' });
  }
}


/**************************************************************************
 Deletes all savegames
**************************************************************************/
function delete_all_savegames()
{
  const stored_password = simpleStorage.get("password", "");
  if (stored_password != null && stored_password != false) {
    const shaObj = new jsSHA("SHA-512", "TEXT");
    shaObj.update(stored_password);
    const sha_password = encodeURIComponent(shaObj.getHash("HEX"));

    fetch("/deletesavegame?username=" + encodeURIComponent(username) + "&savegame=ALL"
     + "&sha_password=" + sha_password, { method: 'POST' });
  }
}

/**************************************************************************
 Send a load game command, if requested by user.
 uses HTML5 local storage.
**************************************************************************/
function load_game_check()
{
  const load_game_id = $('#selectable .ui-selected').index();
  const urlParams = new URLSearchParams(window.location.search);
  const scenario = urlParams.get('scenario');

  if (urlParams.get('load') === "tutorial") {
    $.blockUI();
    wait_for_text("You are logged in as", function () {
      load_game_real('tutorial');
    });
    wait_for_text("Load complete", load_game_toggle);

  } else if (load_game_id !== -1) {
    $.blockUI();
    if (scenario === "true" || scenario_activated) {
        const scenario_game_id = scenarios[load_game_id]['savegame'];
        wait_for_text("You are logged in as", function () {
          load_game_real(scenario_game_id);
        });
        wait_for_text("Load complete", load_game_toggle);
      }
  } else if (scenario === "true" && urlParams.get('load') !== "tutorial") {
    show_scenario_dialog();
  } else if (urlParams.get('action') === "load") {
    show_load_game_dialog();
  }

}


/**************************************************************************
 Send a load game command, if requested by user.
**************************************************************************/
function load_game_real(filename)
{
      console.log("Server command: /load " + filename );
      send_message("/load " + filename);
      $.unblockUI();
      game_loaded = true;
}


/**************************************************************************
...
**************************************************************************/
function set_metamessage_on_loaded_game(game_type)
{
  if (game_type == "multi") {
    metamessage_changed = true;
    send_message("/metamessage Multiplayer game loaded by " + username);
    loaded_game_type = game_type;
  } else if (game_type == "hotseat") {
    hotseat_enabled = true;
    loaded_game_type = game_type;
  }

}


/**************************************************************************
 Aitoggle and take first player.
**************************************************************************/
function load_game_toggle()
{

  send_message("/set nationset all");

  if (players == null || players[0] == null) {
    message_log.update({
      event: E_LOG_ERROR,
      message: "Error: Unable to aitoggle and take your player. Try reloading the page."
    });
    $.unblockUI();
    return;
  }
    
  const firstplayer = players[0]['name'].split(" ")[0];

  if (new URLSearchParams(window.location.search).get('scenario') === "true" || scenario_activated) {
    send_message("/set aifill 6");
  }

  send_message("/aitoggle " + firstplayer);
  send_message("/take " + firstplayer);
  $.unblockUI();


}




/**************************************************************************
 Show the select scenario dialog.
**************************************************************************/
function show_scenario_dialog()
{

  // reset dialog page.
  $("#dialog").remove();
  $("<div id='dialog'></div>").appendTo("div#game_page");
  $.unblockUI();

  let saveHtml =  "<ol id='selectable'>";
    for (let i = 0; i < scenarios.length; i++) {
      saveHtml += "<li class='ui-widget-content'><img border='0' src='" + scenarios[i]['img']
	       +  "' style='padding: 4px;' ><br>" + scenarios[i]['description'] + "</li>";
    }

  saveHtml += "</ol>";

  $("#dialog").html(saveHtml);
  $("#dialog").attr("title", "Select a scenario to play:");
  $("#selectable").css("height", $(window).height() - 180);
  $("#dialog").dialog({
            bgiframe: true,
            modal: true,
            width: "65%",
            position: {my: 'center bottom', at: 'center bottom', of: window},
            buttons: [
                {
                    text: "Cancel",
                    click: function() {
                        $("#dialog").dialog('close');
                    },
                    icon: "ui-icon-close"
                },
                {
                    text: "Select scenario",
                    click: function() {
                        if ($('#selectable .ui-selected').index() == -1) {
                            swal("Please select a scenario first.");
                        } else {
                            scenario_activated = true;
                            load_game_check();
                            $("#dialog").dialog('close');
                            $("#game_text_input").blur();
                        }
                    },
                    icon: "ui-icon-check"
                }
            ]















        });
  $("#selectable").selectable();
  $("#dialog").dialog('open');
  $("#game_text_input").blur();

}
