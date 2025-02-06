<%@ taglib prefix="c" uri="http://java.sun.com/jsp/jstl/core"%>
<%@ taglib prefix="fn" uri="http://java.sun.com/jsp/jstl/functions"%>
<%@ include file="/WEB-INF/jsp/fragments/i18n.jsp"%>
<!DOCTYPE html>
<html lang="en">
<head>
<%@include file="/WEB-INF/jsp/fragments/head.jsp"%>

<style>
	.nav-tabs {
		margin-top: 5px;
	}
	.nav>li>a:hover {
		background-color: #796f6f
	}
	.nav-tabs>li>a {
		background-color: #ecb66a;
		text-transform: uppercase;
		color: #fff;
	    font-weight: 700;		
	}
	.nav-tabs>li.active>a {
		color: #fff;
	}
	.nav-tabs>li.active>a, .nav-tabs>li.active>a:hover, .nav-tabs>li.active>a:focus {
	    background-color: #be602d;
	    color: #fff;
	}
	.tab-pane {
		background-color: #fcf1e0;
	}
	.table {
		background-color: #fcf1e0;
	}
	.table td {
		vertical-align: middle;
	}
	.label-lg {
		font-size: 13px;
	}
	.label-lg:not(:last-child) {
		margin-right: 3px;
	}
	.private-game {
		font-style: italics;
	}
	.running-game {
		font-weight: bold;
	}
	.highlight {
		color: green;
		font-weight: bold;
	}
	.active-player {
		font-weight: bold;
	}
	#multiplayer-table td:last-child {
		width: 290px;
	}
	#singleplayer-table td:last-child {
		width: 140px;
	}
</style>
	
	
</head>
<body>
	<%@include file="/WEB-INF/jsp/fragments/header.jsp" %>
	
	<!-- Begin page content -->
	<div id="content" class="container">
		<div>
			<ul class="nav nav-tabs hidden-xs" role="tablist">
				<li role="presentation active}"><a href="#"
					aria-controls="multi-player" role="tab" data-toggle="tab">PLAYERS OF FREECIVX (${playersCount})</a></li>
			</ul>


			<div class="tab-content">
	
				<div role="tabpanel" class="tab-pane active" id="multi-player-tab">
					<c:if test="${fn:length(playersList) > 0}">
						<table id="multiplayer-table" class="table">
							<tr>
								<th>Name:</th>
								<th>Login:</th>
								<th>Elo rating:</th>
								<th class="hidden-xs">Online</th>
							</tr>
							<c:forEach items="${playersList}" var="player">
								<tr
									class="">
									<td >
								       <b>${player.name}</b>
									</td>
                                    <td >
                                       ${player.formattedLastLogin}
                                    </td>
                                    <td >
                                       ${player.elo_rating}
                                    </td>
                                    <td >
                                       ${player.onlineStatusHtml}
                                    </td>
								</tr>
							</c:forEach>
						</table>
					</c:if>
					<c:if test="${fn:length(multiPlayerGamesList) == 0}">
						No servers currently listed
					</c:if>
				</div>
			</div>
		</div>

		<%@include file="/WEB-INF/jsp/fragments/footer.jsp"%>
	</div>


<script>
$(document).ready(function(){





});

</script>
</body>
</html>
