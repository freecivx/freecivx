<%@ taglib prefix="c" uri="http://java.sun.com/jsp/jstl/core" %>
<%@ taglib prefix="fn" uri="http://java.sun.com/jsp/jstl/functions" %> 
<%@ include file="/WEB-INF/jsp/fragments/i18n.jsp" %>
<!DOCTYPE html>
<html lang="en">
<head>
	<%@include file="/WEB-INF/jsp/fragments/head.jsp"%>
	<script src="/javascript/libs/Detector.js"></script>
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
						FreecivX.net was first launched 18th June 2024, and is based on Freeciv-web from 2013, based on Freeciv which was started in 1996.</h4>

					</div>
				</div>
			</div> <!-- end statistics -->
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
						<a href="https://github.com/freecivx/freecivx"><fmt:message key="index-developers"/></a> are welcome to join development.
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
				<div class="col-md-4">			
  			            <iframe src="https://discord.com/widget?id=1294580999392591933&theme=dark" width="350" height="500" allowtransparency="true" frameborder="0" sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"></iframe>
				</div>
			</div> <!-- end developers -->
		</c:if>

		<%@include file="/WEB-INF/jsp/fragments/footer.jsp"%>
	</div>
</body>
</html>	
