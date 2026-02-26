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
String rendererParam = null;
try {
  Properties prop = new Properties();
  prop.load(getServletContext().getResourceAsStream("/WEB-INF/config.properties"));
  captchaKey = stripToEmpty(prop.getProperty("captcha_public"));

  String debugParam = request.getParameter("debug");
  fcwDebug = (debugParam != null && (debugParam.isEmpty() || parseBoolean(debugParam)));


  String appParam = request.getParameter("app");
  app = (appParam != null && (appParam.isEmpty() || parseBoolean(appParam)));

  // Read renderer parameter from URL (renderer=webgpu or renderer=webgl)
  rendererParam = stripToNull(request.getParameter("renderer"));

} catch (IOException e) {
  e.printStackTrace();
}
%>
<!DOCTYPE html>
<html>
<head>
<title>FreecivWorld.net Freeciv3D the 3D version of Freeciv</title>

<link href="/static/css/bootstrap.min.css" rel="stylesheet">

<link rel="stylesheet" href="/css/fontawesome.min.css">
<link rel="stylesheet" href="/css/solid.min.css">
<link rel="stylesheet" type="text/css" href="/css/webclient.min.css?ts=${initParam.buildTimeStamp}" />
<meta name="description" content="FreecivWorld.net play Freeciv in 3D online for free, open source strategy game">
<meta property="og:image" content="/images/freecivx-icon-web2.jpg" />

<script src="/v86/xterm.js"></script>
<script src="/v86/libv86.js"></script>

<!-- Global configuration variables -->
<script>
var ts="${initParam.buildTimeStamp}";
var fcwDebug=<%= fcwDebug %>;
<% if (rendererParam != null) { %>
// Renderer type set via URL parameter
var renderer_type_override="<%= rendererParam %>";
<% } %>
</script>

<!-- Three.js ES Module System  -->
<script type="importmap">
  {
    "imports": {
      "three": "/javascript/webgpu/libs/threejs/three.module.min.js?ts=${initParam.buildTimeStamp}",
      "three/webgpu": "/javascript/webgpu/libs/threejs/three.webgpu.min.js?ts=${initParam.buildTimeStamp}",
      "three/tsl": "/javascript/webgpu/libs/threejs/three.tsl.min.js?ts=${initParam.buildTimeStamp}"
    }
  }
</script>
<!-- Three.js module loader - exports to window for backward compatibility -->
<script type="module" src="/javascript/three-modules.js?ts=${initParam.buildTimeStamp}"></script>
<!-- OverlayScrollbars module loader - exports to window for backward compatibility -->
<script type="module" src="/javascript/libs/overlayscrollbars-global.js?ts=${initParam.buildTimeStamp}"></script>
<!-- WebGPU module loader - always loaded as WebGPU is required -->
<script type="module" src="/javascript/three-modules-webgpu.js?ts=${initParam.buildTimeStamp}"></script>




<!-- Main application bundle - includes jQuery, Stacktrace, Audio, and all application code -->
<script src="/javascript/webclient.min.js?ts=${initParam.buildTimeStamp}" defer></script>

<!-- WebLLM API for AI text generation -->
<script src="/javascript/web_llm_api.js?ts=${initParam.buildTimeStamp}"></script>

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
