<%@ page import="java.util.Properties" %>
<%@ page import="java.io.IOException" %>
<%@ page import="static org.apache.commons.lang3.StringUtils.stripToNull" %>
<%@ page import="static org.apache.commons.lang3.StringUtils.stripToEmpty" %>
<%@ page import="static java.lang.Boolean.parseBoolean" %>
<%@ taglib prefix="c" uri="http://java.sun.com/jsp/jstl/core" %>
<%
String captchaKey = null;
boolean fcwDebug = false;
boolean webgpu = false;
boolean app = false;
try {
  Properties prop = new Properties();
  prop.load(getServletContext().getResourceAsStream("/WEB-INF/config.properties"));
  captchaKey = stripToEmpty(prop.getProperty("captcha_public"));

  String debugParam = request.getParameter("debug");
  fcwDebug = (debugParam != null && (debugParam.isEmpty() || parseBoolean(debugParam)));

  String webgpuParam = request.getParameter("webgpu");
  webgpu = (webgpuParam != null && (!webgpuParam.isEmpty() || parseBoolean(webgpuParam)));

  String appParam = request.getParameter("app");
  app = (appParam != null && (appParam.isEmpty() || parseBoolean(appParam)));

} catch (IOException e) {
  e.printStackTrace();
}
%>
<!DOCTYPE html>
<html>
<head>
<title>FREECIVX.NET - 3D browser version of the strategy game Freeciv.</title>

<link href="/static/css/bootstrap.min.css" rel="stylesheet">

<link rel="stylesheet" href="/css/fontawesome.min.css">
<link rel="stylesheet" href="/css/solid.min.css">
<link rel="stylesheet" type="text/css" href="/css/webclient.min.css?ts=${initParam.buildTimeStamp}" />
<meta name="description" content="FreecivX.net play Freeciv in 3D online for free, open source strategy game">
<meta property="og:image" content="/images/freecivx-icon-web2.jpg" />

<script type="text/javascript">
var ts="${initParam.buildTimeStamp}";
var fcwDebug=<%= fcwDebug %>;
var webgpu = <%= webgpu %>;
</script>
<script type="text/javascript" src="/javascript/libs/jquery.min.js?ts=${initParam.buildTimeStamp}"></script>

<script src="https://apis.google.com/js/platform.js"></script>

<script type="text/javascript" src="/javascript/libs/stacktrace.min.js"></script>

<% if (!webgpu) { %>
  <script type="importmap">
        {
                "imports": {
                        "three": "/javascript/webgl/libs/r174/three.module.min.js?ts=${initParam.buildTimeStamp}"
                }
        }
  </script>
<% } else { %>
  <script type="importmap">
        {
                "imports": {
                        "three": "/javascript/webgpu/libs/r174/three.webgpu.min.js?ts=${initParam.buildTimeStamp}"
                }
        }
  </script>
<% } %>
<script type="module">
  import * as THREE from 'three';
  window.THREE = THREE;

    <% if (webgpu) { %>
      import { WebGPURenderer } from '/javascript/webgpu/libs/r174/three.webgpu.min.js?ts=${initParam.buildTimeStamp}';
      window.WebGPURenderer = WebGPURenderer;
    <% } %>

  import { GLTFLoader } from '/javascript/webgl/libs/GLTFLoader.js?ts=${initParam.buildTimeStamp}';
  window.GLTFLoader = GLTFLoader;

  import { OrbitControls } from '/javascript/webgl/libs/OrbitControls.js?ts=${initParam.buildTimeStamp}';
  window.OrbitControls = OrbitControls;



  import { AnaglyphEffect } from '/javascript/webgl/effects/AnaglyphEffect.js?ts=${initParam.buildTimeStamp}';
  window.AnaglyphEffect = AnaglyphEffect;

  import { DRACOLoader } from '/javascript/webgl/libs/DRACOLoader.js?ts=${initParam.buildTimeStamp}';
  window.DRACOLoader = DRACOLoader;


</script>


<script type="text/javascript" src="/javascript/webclient.min.js?ts=${initParam.buildTimeStamp}"></script>

<script type="text/javascript" src="/music/audio.min.js"></script>

<link rel="shortcut icon" href="/images/freeciv-shortcut-icon.png" />
<link rel="apple-touch-icon" href="/images/freeciv-splash4.png" />

<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0, minimal-ui" />
<meta name="mobile-web-app-capable" content="yes">

</head>


<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-1MPXPYYNLW"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'G-1MPXPYYNLW');
</script>



<body>

  <div id="introtxtja">FREECIVX.NET is the 3D version of the strategy game Freeciv. Because Civilization should be free, in 3D!</div>

    <div class="container">
        <%@include file="/WEB-INF/jsp/fragments/header.jsp"%>

    </div>

    <jsp:include page="pregame.jsp" flush="false"/>
    <jsp:include page="game.jsp" flush="false"/>

</body>

</html>
