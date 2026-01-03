<nav class="navbar navbar-inverse navbar-fixed-top">
	<div class="container">
		<!-- Brand and toggle get grouped for better mobile display -->
		<div class="navbar-header">
		<button id="fcw-frontpage-nav-button" type="button" class="navbar-toggle collapsed" data-toggle="collapse" data-target="#bs-example-navbar-collapse-1" aria-expanded="false">
			<span class="sr-only"><fmt:message key="nav-toggle-navigation"/></span>
			<span class="icon-bar"></span>
			<span class="icon-bar"></span>
			<span class="icon-bar"></span>
		</button>
		<a class="navbar-brand" href="/">
			<!--Logo font is: Liberation Sans Bold Italic -->
			<img src="/static/images/brand.png" alt="FreecivWorld">
		</a>
		</div>

		<!-- Collect the nav links, forms, and other panel-freeciv for toggling -->
		<div class="collapse navbar-collapse" id="bs-example-navbar-collapse-1">
		<ul class="nav navbar-nav">
			<li><a href="/webclient/?action=new&type=singleplayer">New Game</a></li>
			<li class="dropdown">
				<a href="/game/list?v=singleplayer" class="dropdown-toggle" data-toggle="dropdown" role="button" aria-haspopup="true" aria-expanded="false">
					<span onclick="window.location='/game/list'">Multiplayer Games</span>
					<span class="badge ongoing-games-number" id="ongoing-games" title="Ongoing games"></span>
				</a>
			</li>
			<li><a href="/player/list">Players</a></li>
			<li><a href="https://github.com/freecivworld/freecivworld/">GitHub</a></li>


		    <li><a href="/about">About</a></li>
</ul>
		</div><!-- end navbar-collapse -->
	</div><!-- end container-fluid -->
</nav> <!-- end nav -->
<script src="/static/javascript/header.js"></script>

