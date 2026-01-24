<%@ page import="java.util.Properties" %>
<%@ page import="java.io.IOException" %>
<%@ page import="static org.apache.commons.lang3.StringUtils.stripToNull" %>
<%@ page import="static org.apache.commons.lang3.StringUtils.stripToEmpty" %>
<%@ page import="static java.lang.Boolean.parseBoolean" %>
<%@ taglib prefix="c" uri="http://java.sun.com/jsp/jstl/core" %>
<%
String captchaKey = null;
boolean fcwDebug = false;

boolean app = false;
boolean useViteBuild = false;
try {
  Properties prop = new Properties();
  prop.load(getServletContext().getResourceAsStream("/WEB-INF/config.properties"));
  captchaKey = stripToEmpty(prop.getProperty("captcha_public"));

  String debugParam = request.getParameter("debug");
  fcwDebug = (debugParam != null && (debugParam.isEmpty() || parseBoolean(debugParam)));


  String appParam = request.getParameter("app");
  app = (appParam != null && (appParam.isEmpty() || parseBoolean(appParam)));

  String viteBuildParam = request.getParameter("vite");
  useViteBuild = (viteBuildParam != null && (viteBuildParam.isEmpty() || parseBoolean(viteBuildParam)));

} catch (IOException e) {
  e.printStackTrace();
}
%>
<!DOCTYPE html>
<html>
<head>
<title>FreecivWorld.net - 3D browser version of the strategy game Freeciv.</title>

<link href="/static/css/bootstrap.min.css" rel="stylesheet">

<link rel="stylesheet" href="/css/fontawesome.min.css">
<link rel="stylesheet" href="/css/solid.min.css">
<link rel="stylesheet" type="text/css" href="/css/webclient.min.css?ts=${initParam.buildTimeStamp}" />
<meta name="description" content="FreecivWorld.net play Freeciv in 3D online for free, open source strategy game">
<meta property="og:image" content="/images/freecivx-icon-web2.jpg" />

<!-- Global configuration variables -->
<script>
var ts="${initParam.buildTimeStamp}";
var fcwDebug=<%= fcwDebug %>;
</script>

<!-- Core dependencies - loaded synchronously for compatibility -->
<script src="/javascript/libs/jquery.min.js?ts=${initParam.buildTimeStamp}"></script>

<!-- External services -->
<script src="https://apis.google.com/js/platform.js" defer></script>

<!-- Error tracking -->
<script src="/javascript/libs/stacktrace.min.js" defer></script>

<!-- Three.js ES Module System - Modern import map pattern for Vite compatibility -->
<script type="importmap">
  {
    "imports": {
      "three": "/javascript/webgl/libs/threejs/three.module.min.js?ts=${initParam.buildTimeStamp}"
    }
  }
</script>
<!-- Three.js module loader - exports to window for backward compatibility -->
<script type="module" src="/javascript/three-modules.js?ts=${initParam.buildTimeStamp}"></script>

<!-- Main application bundle -->
<% if (useViteBuild) { %>
<script type="module" src="/javascript/webclient-vite.min.js?ts=${initParam.buildTimeStamp}"></script>
<% } else { %>
<script src="/javascript/webclient.min.js?ts=${initParam.buildTimeStamp}" defer></script>
<% } %>

<!-- Audio system -->
<script src="/music/audio.min.js" defer></script>

<link rel="shortcut icon" href="/images/freeciv-shortcut-icon.png" />
<link rel="apple-touch-icon" href="/images/freeciv-splash4.png" />

<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0, minimal-ui" />
<meta name="mobile-web-app-capable" content="yes">

</head>



<body>

  <div id="introtxtja">FreecivWorld.net is the 3D version of the strategy game Freeciv. Because Civilization should be free, in 3D!</div>

    <div class="container">
        <%@include file="/WEB-INF/jsp/fragments/header.jsp"%>

    </div>

    <jsp:include page="pregame.jsp" flush="false"/>
    <jsp:include page="game.jsp" flush="false"/>

</body>

</html>
