<div id="fciv-intro">
  <div id="fciv-intro-txt">
    <div class="intro-content">
      <h1 class="intro-title">Freecivx</h1>
      <p class="intro-subtitle">3D Empire-Building Strategy</p>
      <p class="intro-main">
        A free and open-source strategy game. Begin in the Stone Age and guide your civilization through centuries of progress — now in 3D!
      </p>
      <div class="intro-cta">
        <a href="/webclient/?action=new&amp;type=singleplayer" class="intro-play-btn" aria-label="Play Freecivx now"><i class="fa fa-play" aria-hidden="true"></i> Play Now</a>
      </div>
      <p class="intro-license">
        Open source under the <a href="https://www.gnu.org/licenses/agpl-3.0.en.html" target="_blank" rel="noopener">AGPL license</a>
      </p>
    </div>
  </div>
</div>


<div id="pregame_page" style="display:none;">
  <div id="pregame_options">
	<div id="pregame_buttons">
		<div id="freeciv_logo" style="cursor:pointer;" onclick="window.open('/', '_new');" role="button" tabindex="0" aria-label="Open Freecivx homepage in new window">
		</div>
		<button id="start_game_button" type="button" class="button" aria-label="Start the game"><i class="fa fa-play" aria-hidden="true"></i> <b>Start Game</b></button>
		<button id="load_game_button" type="button" class="button" aria-label="Load a saved game or scenario"><i class="fa fa-folder-open" aria-hidden="true"></i> Load Game / Scenario</button>
		<button id="pick_nation_button" type="button" class="button" aria-label="Choose your nation"><i class="fa fa-flag" aria-hidden="true"></i> Pick Nation</button>
		<button id="pregame_settings_button" type="button" class="button" aria-label="Configure game settings"><i class="fa fa-cogs" aria-hidden="true"></i> Game Settings</button>
		<button id='multiplayer_invite_player' type="button" class="button" aria-label="Invite another player to join"><i class="fa fa-user-plus" aria-hidden="true"></i> Invite player</button>
	</div>
  </div>

  <div id="pregame_content_wrapper">
    <div id="pregame_player_list" role="list" aria-label="Player list"></div>
    <div id="pregame_main_area">
      <div id="pregame_game_info" aria-live="polite"></div>
      <div id="pregame_custom_scrollbar_div">
        <ol id="pregame_message_area" role="log" aria-live="polite" aria-label="Game messages"></ol>
      </div>
    </div>
  </div>
  
  <div id="pregame_chat_box">
    <label for="pregame_text_input" class="sr-only">Chat input</label>
    <input id="pregame_text_input" type="text" name="text_input" value=">" aria-label="Enter chat message or game command" />
  </div>
</div>

<div id="pick_nation_dialog" ></div>
