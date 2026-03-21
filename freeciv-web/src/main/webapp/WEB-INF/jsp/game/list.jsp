<%@ taglib prefix="c" uri="http://java.sun.com/jsp/jstl/core"%>
<%@ taglib prefix="fn" uri="http://java.sun.com/jsp/jstl/functions"%>
<%@ include file="/WEB-INF/jsp/fragments/i18n.jsp"%>
<!DOCTYPE html>
<html lang="en">
<head>
<%@include file="/WEB-INF/jsp/fragments/head.jsp"%>
<link rel="stylesheet" href="/css/fontawesome.min.css">
<link rel="stylesheet" href="/css/solid.min.css">
<title>Multiplayer Games - Freecivx</title>

<style>
	/* ── Hero banner ── */
	.game-list-hero {
		background: linear-gradient(135deg, #1a3a5c 0%, #0d2540 60%, #071526 100%);
		color: #fff;
		padding: 16px 0 14px;
		margin-bottom: 24px;
		border-radius: 0 0 8px 8px;
		box-shadow: 0 4px 18px rgba(0,0,0,0.28);
	}
	.game-list-hero h1 {
		font-family: 'Fredericka the Great', cursive;
		color: #b8d4f0;
		border-bottom: none;
		margin: 0 0 4px 0;
		font-size: 1.6rem;
		letter-spacing: 1px;
	}
	.game-list-hero .subtitle {
		color: #8ab4d8;
		font-size: 0.88rem;
		margin-bottom: 10px;
	}
	.hero-stats {
		display: flex;
		gap: 14px;
		flex-wrap: wrap;
		justify-content: center;
		margin-top: 6px;
	}
	.hero-stat {
		background: rgba(255,255,255,0.10);
		border: 1px solid rgba(255,255,255,0.18);
		border-radius: 8px;
		padding: 7px 16px;
		text-align: center;
		min-width: 100px;
	}
	.hero-stat .stat-number {
		font-size: 1.6rem;
		font-weight: 700;
		color: #7ec8f0;
		line-height: 1.1;
	}
	.hero-stat .stat-label {
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 1px;
		color: #8ab4d8;
		margin-top: 2px;
	}

	/* ── Section heading ── */
	.section-heading {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 16px;
	}
	.section-heading h2 {
		font-family: 'Fredericka the Great', cursive;
		color: #be602d;
		border-bottom: none;
		margin: 0;
		font-size: 1.5rem;
	}
	.section-heading .badge-count {
		background: #be602d;
		color: #fff;
		border-radius: 12px;
		padding: 3px 11px;
		font-size: 0.88rem;
		font-weight: 700;
	}

	/* ── Game cards ── */
	.game-cards {
		display: grid;
		grid-template-columns: 1fr;
		gap: 4px;
		margin-bottom: 4px;
	}
	.game-card {
		background: #fffaf3;
		border: 1px solid #e0c98a;
		border-radius: 10px;
		box-shadow: 0 2px 8px rgba(190,96,45,0.08);
		padding: 4px 4px 4px;
		transition: box-shadow 0.18s, transform 0.18s;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.game-card:hover {
		box-shadow: 0 6px 20px rgba(190,96,45,0.18);
		transform: translateY(-2px);
	}
	.game-card.running {
		border-left: 4px solid #27ae60;
	}
	.game-card.pregame {
		border-left: 4px solid #d3b86f;
	}
	.game-card.private {
		border-left: 4px solid #8e44ad;
		font-style: italic;
	}

	/* ── Card header ── */
	.card-header-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 8px;
	}
	.card-message {
		font-size: 1.25rem;
		font-weight: 700;
		color: #3d2b1f;
		flex: 1;
		word-break: break-word;
	}
	.status-badge {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		border-radius: 20px;
		padding: 3px 11px;
		font-size: 0.78rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		white-space: nowrap;
	}
	.status-badge.running {
		background: #eafaf1;
		color: #1e8449;
		border: 1px solid #a9dfbf;
	}
	.status-badge.pregame {
		background: #fef9ec;
		color: #9a7d0a;
		border: 1px solid #d3b86f;
	}
	.status-badge.other {
		background: #f2f3f4;
		color: #566573;
		border: 1px solid #ccc;
	}

	/* ── Card meta ── */
	.card-meta {
		display: flex;
		gap: 16px;
		flex-wrap: wrap;
		color: #6e5a48;
		font-size: 0.88rem;
	}
	.card-meta-item {
		display: flex;
		align-items: center;
		gap: 5px;
	}
	.card-meta-item i {
		color: #be602d;
		width: 14px;
		text-align: center;
	}

	/* ── Card actions ── */
	.card-actions {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		margin-top: 4px;
	}
	.btn-play {
		background: linear-gradient(135deg, #27ae60, #1e8449);
		color: #fff;
		border: none;
		border-radius: 6px;
		padding: 7px 18px;
		font-size: 0.88rem;
		font-weight: 700;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		transition: background 0.15s, box-shadow 0.15s;
		box-shadow: 0 2px 6px rgba(39,174,96,0.3);
	}
	.btn-play:hover {
		background: linear-gradient(135deg, #2ecc71, #27ae60);
		color: #fff;
		text-decoration: none;
		box-shadow: 0 4px 12px rgba(39,174,96,0.4);
	}
	.btn-observe {
		background: linear-gradient(135deg, #e67e22, #d35400);
		color: #fff;
		border: none;
		border-radius: 6px;
		padding: 7px 14px;
		font-size: 0.88rem;
		font-weight: 700;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		transition: background 0.15s, box-shadow 0.15s;
		box-shadow: 0 2px 6px rgba(230,126,34,0.3);
	}
	.btn-observe:hover {
		background: linear-gradient(135deg, #f39c12, #e67e22);
		color: #fff;
		text-decoration: none;
	}
	.btn-info-link {
		background: transparent;
		color: #be602d;
		border: 1px solid #be602d;
		border-radius: 6px;
		padding: 7px 14px;
		font-size: 0.88rem;
		font-weight: 600;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		transition: background 0.15s, color 0.15s;
	}
	.btn-info-link:hover {
		background: #be602d;
		color: #fff;
		text-decoration: none;
	}

	/* ── Empty state ── */
	.empty-state {
		text-align: center;
		padding: 52px 24px;
		background: #fffaf3;
		border: 2px dashed #d3b86f;
		border-radius: 10px;
		color: #9a7d5a;
	}
	.empty-state i {
		font-size: 2.8rem;
		color: #d3b86f;
		margin-bottom: 14px;
		display: block;
	}
	.empty-state p {
		font-size: 1.05rem;
		margin: 0;
	}

	/* ── Responsive tweaks ── */
	@media (max-width: 600px) {
		.game-list-hero h1 { font-size: 1.2rem; }
		.hero-stats { gap: 8px; }
		.hero-stat { min-width: 80px; padding: 6px 10px; }
	}
</style>

</head>
<body>
	<%@include file="/WEB-INF/jsp/fragments/header.jsp" %>

	<!-- Hero banner -->
	<div class="game-list-hero">
		<div class="container text-center">
			<h1 style="font-size:200%;"><i class="fa fa-globe"></i> Multiplayer Games</h1>
			<p class="subtitle">Join or observe live Freecivx games &mdash; civilization awaits!</p>
			<div class="hero-stats">
				<div class="hero-stat">
					<div class="stat-number" id="ongoing-games-hero">—</div>
					<div class="stat-label">Active Games</div>
				</div>
				<div class="hero-stat">
					<div class="stat-number" id="stats-mp-hero">—</div>
					<div class="stat-label">Multiplayer Played</div>
				</div>
				<div class="hero-stat">
					<div class="stat-number" id="stats-players-hero">—</div>
					<div class="stat-label">Players</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Begin page content -->
	<div id="content" class="container">

		<c:choose>
			<c:when test="${fn:length(multiPlayerGamesList) > 0}">

				<%-- Count both types in a single pass --%>
				<c:set var="freecivxCount" value="${0}" />
				<c:set var="cServerCount" value="${0}" />
				<c:forEach items="${multiPlayerGamesList}" var="game">
					<c:choose>
						<c:when test="${game.type eq 'freecivx'}">
							<c:set var="freecivxCount" value="${freecivxCount + 1}" />
						</c:when>
						<c:otherwise>
							<c:set var="cServerCount" value="${cServerCount + 1}" />
						</c:otherwise>
					</c:choose>
				</c:forEach>

				<%-- ── Freeciv C Server Games ── --%>
				<div class="section-heading">
					<h1><i class="fa fa-users"></i> Freeciv C Server Games</h1>
					<span class="badge-count">${cServerCount}</span>
				</div>

				<c:choose>
					<c:when test="${cServerCount > 0}">
						<div class="game-cards" id="cserver-games-tab">
							<c:forEach items="${multiPlayerGamesList}" var="game">
								<c:if test="${game.type ne 'freecivx'}">
									<div class="game-card ${game.isProtected() ? 'private' : (game.state eq 'Running' ? 'running' : 'pregame')}">

										<!-- Header: message + status -->
										<div class="card-header-row">
											<span class="card-message">
												<c:choose>
													<c:when test="${game.isProtected()}">
														<i class="fa fa-lock" title="Password protected"></i>&nbsp;
													</c:when>
												</c:choose>
												<c:choose>
													<c:when test="${not empty game.message}">${game.message}</c:when>
													<c:otherwise>Freeciv Game</c:otherwise>
												</c:choose>
											</span>
											<c:choose>
												<c:when test="${game.state eq 'Running'}">
													<span class="status-badge running"><i class="fa fa-play-circle"></i> Running</span>
												</c:when>
												<c:when test="${game.state eq 'Pregame'}">
													<span class="status-badge pregame"><i class="fa fa-hourglass-start"></i> Pregame</span>
												</c:when>
												<c:otherwise>
													<span class="status-badge other"><i class="fa fa-circle"></i> ${game.state}</span>
												</c:otherwise>
											</c:choose>
										</div>

										<!-- Meta: players + turn -->
										<div class="card-meta">
											<span class="card-meta-item">
												<i class="fa fa-users"></i>
												<c:choose>
													<c:when test="${game.players == 0}">No players</c:when>
													<c:when test="${game.players == 1}">1 player</c:when>
													<c:otherwise>${game.players} players</c:otherwise>
												</c:choose>
											</span>
											<c:if test="${game.turn > 0}">
												<span class="card-meta-item">
													<i class="fa fa-history"></i> Turn ${game.turn}
												</span>
											</c:if>
											<c:if test="${game.isProtected()}">
												<span class="card-meta-item">
													<i class="fa fa-lock"></i> Password required
												</span>
											</c:if>
										</div>

										<!-- Actions -->
										<div class="card-actions">
											<c:choose>
												<c:when test="${game.state ne 'Running'}">
													<a class="btn-play"
														href="/webclient/?action=multi&amp;civserverport=${game.port}&amp;civserverhost=${game.host}&amp;multi=true&amp;type=${game.type}">
														<i class="fa fa-play"></i> Play 3D
													</a>
												</c:when>
												<c:otherwise>
													<a class="btn-play"
														href="/webclient/?action=multi&amp;civserverport=${game.port}&amp;civserverhost=${game.host}&amp;multi=true&amp;type=${game.type}">
														<i class="fa fa-play"></i> Play 3D
													</a>
													<c:if test="${game.type ne 'longturn'}">
														<a class="btn-observe"
															href="/webclient/?action=observe&amp;civserverport=${game.port}&amp;civserverhost=${game.host}&amp;multi=true&amp;type=${game.type}">
															<i class="fa fa-eye"></i> Observe
														</a>
													</c:if>
												</c:otherwise>
											</c:choose>
											<a class="btn-info-link" href="/game/details?host=${game.host}&amp;port=${game.port}">
												<i class="fa fa-info-circle"></i> Info
											</a>
										</div>

									</div>
								</c:if>
							</c:forEach>
						</div>
					</c:when>
					<c:otherwise>
						<div class="empty-state">
							<i class="fa fa-server"></i>
							<p>No Freeciv C server games currently running.</p>
						</div>
					</c:otherwise>
				</c:choose>
				<%-- ── Freecivx Server Games (Beta) ── --%>
				<div class="section-heading" style="margin-top:20px;">
					<h1><i class="fa fa-rocket"></i> Freecivx Java Server Games</h1>
					<span class="badge-count">${freecivxCount}</span>
					<span class="badge" style="background:#8e44ad;color:#fff;border-radius:12px;padding:3px 11px;font-size:0.82rem;font-weight:700;">Beta</span>
				</div>

				<c:choose>
					<c:when test="${freecivxCount > 0}">
						<div class="game-cards" id="freecivx-games-tab">
							<c:forEach items="${multiPlayerGamesList}" var="game">
								<c:if test="${game.type eq 'freecivx'}">
									<div class="game-card ${game.isProtected() ? 'private' : (game.state eq 'Running' ? 'running' : 'pregame')}">

										<!-- Header: message + status -->
										<div class="card-header-row">
											<span class="card-message">
												<c:choose>
													<c:when test="${game.isProtected()}">
														<i class="fa fa-lock" title="Password protected"></i>&nbsp;
													</c:when>
												</c:choose>
												<c:choose>
													<c:when test="${not empty game.message}">${game.message}</c:when>
													<c:otherwise>Freecivx Game</c:otherwise>
												</c:choose>
											</span>
											<c:choose>
												<c:when test="${game.state eq 'Running'}">
													<span class="status-badge running"><i class="fa fa-play-circle"></i> Running</span>
												</c:when>
												<c:when test="${game.state eq 'Pregame'}">
													<span class="status-badge pregame"><i class="fa fa-hourglass-start"></i> Pregame</span>
												</c:when>
												<c:otherwise>
													<span class="status-badge other"><i class="fa fa-circle"></i> ${game.state}</span>
												</c:otherwise>
											</c:choose>
										</div>

										<!-- Meta: players + turn -->
										<div class="card-meta">
											<span class="card-meta-item">
												<i class="fa fa-users"></i>
												<c:choose>
													<c:when test="${game.players == 0}">No players</c:when>
													<c:when test="${game.players == 1}">1 player</c:when>
													<c:otherwise>${game.players} players</c:otherwise>
												</c:choose>
											</span>
											<c:if test="${game.turn > 0}">
												<span class="card-meta-item">
													<i class="fa fa-history"></i> Turn ${game.turn}
												</span>
											</c:if>
											<c:if test="${game.isProtected()}">
												<span class="card-meta-item">
													<i class="fa fa-lock"></i> Password required
												</span>
											</c:if>
										</div>

										<!-- Actions -->
										<div class="card-actions">
											<c:choose>
												<c:when test="${game.state ne 'Running'}">
													<a class="btn-play"
														href="/webclient/?action=multi&amp;civserverport=${game.port}&amp;civserverhost=${game.host}&amp;multi=true&amp;type=${game.type}">
														<i class="fa fa-play"></i> Play 3D
													</a>
												</c:when>
												<c:otherwise>
													<a class="btn-play"
														href="/webclient/?action=multi&amp;civserverport=${game.port}&amp;civserverhost=${game.host}&amp;multi=true&amp;type=${game.type}">
														<i class="fa fa-play"></i> Play 3D
													</a>
													<c:if test="${game.type ne 'longturn'}">
														<a class="btn-observe"
															href="/webclient/?action=observe&amp;civserverport=${game.port}&amp;civserverhost=${game.host}&amp;multi=true&amp;type=${game.type}">
															<i class="fa fa-eye"></i> Observe
														</a>
													</c:if>
												</c:otherwise>
											</c:choose>
											<a class="btn-info-link" href="/game/details?host=${game.host}&amp;port=${game.port}">
												<i class="fa fa-info-circle"></i> Info
											</a>
										</div>

									</div>
								</c:if>
							</c:forEach>
						</div>
					</c:when>
					<c:otherwise>
						<div class="empty-state" style="margin-bottom:24px;">
							<i class="fa fa-server"></i>
							<p>No Freecivx server games currently running.</p>
						</div>
					</c:otherwise>
				</c:choose>


			</c:when>
			<c:otherwise>
				<div class="empty-state">
					<i class="fa fa-server"></i>
					<p>No multiplayer servers are currently listed. Check back soon!</p>
				</div>
			</c:otherwise>
		</c:choose>

		<%@include file="/WEB-INF/jsp/fragments/footer.jsp"%>
	</div>

<script>
$(document).ready(function(){
	$.getJSON("/game/statistics", function(data) {
		if (data.ongoing !== undefined) {
			$("#ongoing-games-hero").text(data.ongoing);
		}
		if (data.finished && data.finished.multiPlayer !== undefined) {
			$("#stats-mp-hero").text(data.finished.multiPlayer.toLocaleString());
		}
		if (data.finished && data.finished.players !== undefined) {
			$("#stats-players-hero").text(data.finished.players.toLocaleString());
		}
	}).fail(function() {
		console.log("Could not load game statistics.");
	});
});
</script>
</body>
</html>
