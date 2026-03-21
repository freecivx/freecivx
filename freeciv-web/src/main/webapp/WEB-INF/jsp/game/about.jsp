<%@ taglib prefix="c" uri="http://java.sun.com/jsp/jstl/core" %>
<%@ taglib prefix="fn" uri="http://java.sun.com/jsp/jstl/functions" %> 
<%@ include file="/WEB-INF/jsp/fragments/i18n.jsp" %>
<!DOCTYPE html>
<html lang="en">
<head>
	<%@include file="/WEB-INF/jsp/fragments/head.jsp"%>
	<style>
	/* Make sure that the development tools used in freeciv are not to big */
	img.small {
		max-height: 40px;
	}
	/* 2D/3D teasers must remain within their container. */
	img.teaser {
		display: block;
		margin: auto;
		width: 100%;
	}
	.statistics { text-align: center; }

	/* Game launcher */          
	#game-launcher {
		width: 100%;
		margin: 0 auto;
		font-family: 'Open Sans', Helvetica;
	}
	#game-launcher .game-type {
		width: 100%;
		background: #fcf1e0;
		display: inline-table;
		top: 0;
	}
	#game-launcher .game-type:not(:last-child) { margin-right: 40px; }
	#game-launcher .header {
		color: #000000;
		font-family: 'Fredericka the Great', cursive;
		padding: 15px;
		margin-bottom: 0px;
		background-image: -webkit-linear-gradient(top, #fcf8e3 0, #f8efc0 100%);
		background-image: -o-linear-gradient(top, #fcf8e3 0, #f8efc0 100%);
		background-image: -webkit-gradient(linear, left top, left bottom, color-stop(0, #fcf8e3), to(#f8efc0));
		background-image: linear-gradient(to bottom, #fcf8e3 0, #f8efc0 100%);
		background-repeat: repeat-x;
		filter: progid:DXImageTransform.Microsoft.gradient(startColorstr='#fffcf8e3', endColorstr='#fff8efc0', GradientType=0);
		background-color: #fcf8e3;
		border: 1px solid transparent;
		border-radius: 4px 4px 0 0;
		border-bottom: 0;
		border-color: #f5e79e;
	}
	#game-launcher .name {
		width: 100%;
		font-size: 2em;
		display: block;
		text-align: center;
		padding: 2px 0 2px;
	}
	#game-launcher .features {
		list-style: none;
		text-align: center;               
		margin: 0;
		padding: 10px 0 0 0;                
		font-size: 0.9em;
	}
	#game-launcher .btn {
		display: inline-block;
		color: rgb(255, 255, 255);
		border: 0;
		border-radius: 5px;
		padding: 10px;
		width: 230px;
		display: block;
		font-weight: 700;
		font-size: 20px;
		text-transform: uppercase;
		margin: 20px auto 10px;
		background: #be2d2d;
   text-shadow:
    -0.5px -0.5px 0 #000,
    0.5px -0.5px 0 #000,
    -0.5px 0.5px 0 #000,
    0.5px 0.5px 0 #000;
	}
	#game-launcher a.small { width: 130px;	}
	.multiplayer-games th:last-child { width: 100px; }
	.multiplayer-games a.label:last-child { margin-left: 3px; }
	.multiplayer-games .highlight { 
		color: green;
		font-weight: bold;
	}

	.videoWrapper {
	position: relative;
	padding-bottom: 56.25%; /* 16:9 */
	padding-top: 25px;
	height: 0;
    }

	.videoWrapper iframe {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	}
	.jumbotron {
	padding-bottom: 0px;
	}
	.about-section {
		margin-top: 30px;
		margin-bottom: 10px;
	}
	.about-section h2 {
		border-bottom: 2px solid #f5e79e;
		padding-bottom: 8px;
		margin-bottom: 15px;
	}
	.about-section p {
		font-size: 1.05em;
		line-height: 1.7;
	}
	.how-to-play-steps {
		counter-reset: step-counter;
		list-style: none;
		padding-left: 0;
	}
	.how-to-play-steps li {
		counter-increment: step-counter;
		padding: 8px 0 8px 48px;
		position: relative;
		font-size: 1.02em;
		line-height: 1.6;
	}
	.how-to-play-steps li::before {
		content: counter(step-counter);
		position: absolute;
		left: 0;
		top: 6px;
		background: #be2d2d;
		color: #fff;
		width: 30px;
		height: 30px;
		border-radius: 50%;
		text-align: center;
		line-height: 30px;
		font-weight: bold;
	}
	.game-mode-card {
		background: #fcf1e0;
		border: 1px solid #f5e79e;
		border-radius: 6px;
		padding: 20px;
		margin-bottom: 20px;
		height: 100%;
	}
	.game-mode-card h3 {
		font-family: 'Fredericka the Great', cursive;
		margin-top: 0;
	}
		
  .vcontainer {
    position: relative;
    width: 100%;
    height: 0;
    padding-bottom: 56.25%; 
  }
  .video {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }
		
</style>

</head>
<body>
	<div class="container">
		<%@include file="/WEB-INF/jsp/fragments/header.jsp"%>

		<div class="jumbotron">
			<div class="container-fluid">
				<div class="row top-buffer-3">
					<p class="lead">
						<fmt:message key="index-lead"/>
					</p>
				</div>
			</div>
		</div> <!-- end jumbotron -->

		<div id="game-launcher" class="row">

				<div class="col-md-6">
					<div class="game-type">
						<div class="header">
							<span class="name"> <fmt:message key="index-game-launcher-singleplayer" /></span>
						</div>

						<c:if test="${default_lang}">
							<div class="features">
								Play against the Freeciv AI with 3D WebGL<br>graphics using the Three.js 3D engine
							</div>
						</c:if>
						<a href="/webclient/?action=new&type=singleplayer" class="btn" id="webgl_button">New Game</a>

					</div>
				</div>
				<div class="col-md-6">
					<div class="game-type">
						<div class="header">
							<span class="name"><fmt:message key="index-game-launcher-multiplayer"/></span>
						</div>
						<c:if test="${default_lang}">
							<div class="features">
								Start or join a game with multiple human or AI players.
							</div>
						</c:if>
						<a href="/game/list?v=multiplayer" class="btn"> <fmt:message key="index-game-launcher-multiplayer"/></a>

					</div>
				</div>
		</div> <!-- end game launcher -->

		<c:if test="${default_lang}">
			<div id="statistics" class="row">
				<div class="col-md-12">
					<div class="panel-freeciv statistics">
						<h4><span id="statistics-singleplayer"><b>0</b></span> <fmt:message key="index-stats-singleplayer"/>
						 <span id="statistics-multiplayer"><b>0</b></span> multiplayer games, with
						 <span id="statistics-players"><b>0</b></span> registered players.
						 <br>
						Freecivx.com was first launched January 4 2026, and is based on Freeciv-web from 2013, based on Freeciv which was started in 1996.</h4>

					</div>
				</div>
			</div> <!-- end statistics -->
		</c:if>


		<c:if test="${default_lang}">

			<!-- About Freeciv -->
			<div class="row about-section">
				<div class="col-md-12">
					<h2>About Freeciv</h2>
					<p>
						Freeciv is a free and open-source turn-based strategy game inspired by the classic <em>Civilization</em> series. 
						Players guide a civilization from the ancient era through the space age, founding cities, researching technologies, 
						building armies and wonders, and competing — or cooperating — with other civilizations to achieve victory.
					</p>
					<p>
						The game is played on a procedurally generated world map. Each turn represents years of in-game time, and 
						decisions made early — which technologies to research, where to build cities, when to go to war — have 
						lasting consequences that shape the entire arc of a game.
					</p>
				</div>
			</div>

			<!-- History of Freeciv -->
			<div class="row about-section">
				<div class="col-md-12">
					<h2>History of Freeciv</h2>
					<p>
						Freeciv was created in 1996 by Peter Unold, Claus Leth Gregersen, and Allan Ove Kjeldbjerg at the 
						University of Aarhus in Denmark. Inspired by <em>Civilization II</em>, they wanted to build a free, 
						cross-platform alternative that anyone could play and improve. The project quickly grew into a global 
						open-source effort with contributors from dozens of countries.
					</p>
					<p>
						Over the following years Freeciv gained many features that rivalled — and sometimes surpassed — the 
						commercial titles that inspired it: customizable rulesets, AI opponents, LAN and internet multiplayer, 
						and ports to virtually every desktop operating system. The 2.x releases in the 2000s brought isometric 
						graphics, improved diplomacy, and a richer technology tree. The 3.x series (ongoing) modernised the 
						codebase, improved AI quality, and added support for larger maps and more players.
					</p>
					<p>
						<strong>Freeciv-web</strong>, launched around 2013, brought the game fully into the browser using 
						HTML5 and WebGL — no plugin required. <strong>Freecivx.com</strong> is the next step in that journey, 
						launched in January 2026. It builds on Freeciv-web with a new 3D WebGL/WebGPU renderer powered by 
						Three.js, a rewritten Java game server, and a smoother multiplayer experience.
					</p>
				</div>
			</div>

			<!-- How to Play -->
			<div class="row about-section">
				<div class="col-md-12">
					<h2>How to Play</h2>
					<p>
						Freeciv is a turn-based game — every player takes their turn before time advances. Here is a 
						quick guide to getting started:
					</p>
					<ol class="how-to-play-steps">
						<li>
							<strong>Found your first city.</strong> You start with a Settler unit. Move it to fertile land 
							near fresh water or a coast, then press <kbd>B</kbd> (or click the &ldquo;Build City&rdquo; button) 
							to establish your capital. A good starting location has food-rich tiles nearby.
						</li>
						<li>
							<strong>Research technologies.</strong> Open the Science Advisor and choose a technology to research. 
							Early priorities are usually <em>Pottery</em> (granary), <em>Bronze Working</em> (Phalanx), 
							and <em>The Wheel</em> (Chariots). Technologies unlock new units, buildings, and government types.
						</li>
						<li>
							<strong>Grow your cities.</strong> Place workers on food-rich tiles to grow your population. 
							Build a Granary early so your city retains food when it grows. Bigger cities produce more shields 
							(production) and trade.
						</li>
						<li>
							<strong>Expand.</strong> Build more Settler units to found additional cities. Spread across the 
							map to claim resources before rival civilizations do. Roads and irrigation built by Workers 
							improve the tiles around your cities.
						</li>
						<li>
							<strong>Build an army.</strong> Defend your cities with Warriors or Phalanxes and scout the 
							map with fast units. As you research better technologies you can upgrade to Swordsmen, 
							Musketeers, Riflemen, and eventually Armor and modern units.
						</li>
						<li>
							<strong>Manage your economy.</strong> Balance the tax rate (gold income), science rate 
							(research speed), and luxury rate (citizen happiness) using the Finance Advisor. 
							Running out of gold causes unit and building maintenance to fail.
						</li>
						<li>
							<strong>Diplomacy.</strong> Meet other civilizations and choose your stance: peace, alliance, 
							or war. Trade technologies, negotiate borders, and forge alliances to survive the late game.
						</li>
						<li>
							<strong>Win the game.</strong> Victory can be achieved by launching a Spaceship to Alpha 
							Centauri, by conquering all rival capitals, or by achieving the highest score when the year 
							limit is reached.
						</li>
					</ol>
				</div>
			</div>

			<!-- Game Modes -->
			<div class="row about-section">
				<div class="col-md-12">
					<h2>Game Modes</h2>
				</div>
				<div class="col-md-6">
					<div class="game-mode-card">
						<h3>&#127918; Singleplayer</h3>
						<p>
							Play at your own pace against AI-controlled civilizations. Singleplayer games are 
							saved automatically so you can continue any time. Choose from a range of difficulty 
							levels — from Novice (patient, forgiving AI) to Hard (aggressive, competent opponents).
						</p>
						<p>
							The AI manages cities, research, and military independently. Newer AI versions on 
							Freecivx.com handle diplomacy, great wonders, and era-appropriate unit upgrades, 
							providing a challenging game even for experienced players.
						</p>
						<p>
							The 3D WebGL view renders the world using Three.js, giving cities, units, and terrain 
							a vivid three-dimensional look in your browser — no installation needed.
						</p>
						<a href="/webclient/?action=new&amp;type=singleplayer" class="btn">Play Now</a>
					</div>
				</div>
				<div class="col-md-6">
					<div class="game-mode-card">
						<h3>&#127760; Multiplayer</h3>
						<p>
							Challenge other human players in real-time or turn-based multiplayer games. 
							Multiplayer matches support a mix of human and AI players, so you can fill empty 
							seats with computer opponents and keep the game moving.
						</p>
						<p>
							Games are hosted on the Freecivx.com server — just click &ldquo;Multiplayer,&rdquo; 
							browse open games, and join. You can also create a new game and invite friends by 
							sharing the game link.
						</p>
						<p>
							Compete for the top spot on the global leaderboard. Elo ratings are calculated after 
							each ranked multiplayer game, rewarding consistent wins against strong opponents.
						</p>
						<a href="/game/list?v=multiplayer" class="btn">Multiplayer Games</a>
					</div>
				</div>
			</div>

		</c:if>

		<div class="jumbotron">
			<h2>Game of the day</h2>

			<div class="row">
				<img src="/data/game_of_the_day.png" alt="" style="width: 99%;">

			</div>

		</div> <!-- end jumbotron -->




	    <div class="row">
			<div class="col-md-12">
                    <div class="col-md-12">
		                  <div class="vcontainer">
                                        <iframe  src="https://www.youtube.com/embed/I_fviXqQ1ic" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen class="video"></iframe>
                                        </div>
                                  </div>
			
		    </div>


		<c:if test="${default_lang}">
			<div class="row">
				<div class="col-md-12">
					<h2><fmt:message key="index-developers"/></h2>
				</div>
			</div> 
			<div class="row">
				<div class="col-md-4">
					<div class="panel-freeciv">
						<h4><fmt:message key="index-contributing"/></h4>
						Freeciv is open source software released under the GNU General Public License.
						<a href="https://github.com/freecivworld/freecivworld"><fmt:message key="index-developers"/></a> are welcome to join development.
					</div>
				</div>
				<div class="col-md-4">
					<div class="panel-freeciv">
						<h4><fmt:message key="index-stack"/></h4>
						<b>Frontend:</b><br>

                        <img class="small" src="/static/images/webgpu-stack.png">WebGPU <br>
						<img class="small" src="/static/images/webgl-stack.png">WebGL <br>
						<img class="small" src="/static/images/html5-stack.png">HTML5 <br>
						<img class="small" src="/static/images/three-stack.png">Three.js  <br>
						<img class="small" src="/static/images/blender-stack.png">Blender  <br>
						<br>
						<b>Backend:</b>
						<br>
                        <img class="small" src="/static/images/java-stack.png">Java <br>
                        <img class="small" src="/static/images/tomcat-stack.png">Tomcat  <br>
                        <img class="small" src="/static/images/python-stack.png">Python <br>
					</div>
				</div>
			
			</div> <!-- end developers -->
		</c:if>

		<%@include file="/WEB-INF/jsp/fragments/footer.jsp"%>

		<script src="/static/javascript/header.js"></script>

	</div>
</body>
</html>	
