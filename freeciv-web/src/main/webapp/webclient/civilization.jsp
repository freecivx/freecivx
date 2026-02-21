<div id="civ_dialog">

<h3 id="nation_title"></h3>
<center>
  <div id="civ_dialog_text"></div>
  <div id="civ_dialog_flag"></div>
</center>

<div id="govt_tabs">
  <ul>
    <li><a href="#govt_tabs-overview">Overview</a></li>
    <li><a href="#govt_tabs-revolution">Revolution</a></li>
    <li><a href="#govt_tabs-taxrates">Tax Rates</a></li>
    <li><a href="#govt_tabs-reports">Reports</a></li>
  </ul>
  
  <div id="govt_tabs-overview" class="govt_tabs_content">
    <p>Overview of your civilization and current government.</p>
  </div>
  
  <div id="govt_tabs-revolution" class="govt_tabs_content">
    <div id="revolution_content"></div>
  </div>
  
  <div id="govt_tabs-taxrates" class="govt_tabs_content">
    <div id="taxrates_content"></div>
  </div>
  
  <div id="govt_tabs-reports" class="govt_tabs_content">
    <button id="wonders_report" class="button govbutton" type="button" onclick="request_report(REPORT_WONDERS_OF_THE_WORLD_LONG);">Wonders of the World</button><br>
    <button id="top_cities_report" class="button govbutton" type="button" onclick="request_report(REPORT_TOP_CITIES);">Top 5 Cities</button><br>
    <button id="demography_report" class="button govbutton" type="button" onclick="request_report(REPORT_DEMOGRAPHIC);">Demographics</button><br>
    <button id="spaceship_report" class="button govbutton" type="button" onclick="show_spaceship_dialog();">Spaceship</button><br>
  </div>
</div>

</div>

