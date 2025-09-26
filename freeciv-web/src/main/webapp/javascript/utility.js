/**********************************************************************
    Freeciv-web - the web version of Freeciv. http://www.FreecivX.net/
    Copyright (C) 2009-2015  The Freeciv-web project

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.

***********************************************************************/

var stripChar = [];
stripChar[0] = new RegExp(String.fromCharCode(3), "g");
const STRIPCHAR_LAST = 1;

/****************************************************************************
 ...
****************************************************************************/
function clone(obj){
  if(obj == null || typeof(obj) != 'object') {
    return obj;
  }
  var temp = obj.constructor(); // changed

  for (var key in obj) {
    temp[key] = clone(obj[key]);
  }

  return temp;
}


/*
 * DIVIDE() divides and rounds down, rather than just divides and
 * rounds toward 0.  It is assumed that the divisor is positive.
 */
function DIVIDE (n, d) {
  return parseInt( (n) / (d) - (( (n) < 0 && (n) % (d) < 0 ) ? 1 : 0) );
}

/****************************************************************************
 ...
****************************************************************************/
function FC_WRAP(value, range)
{
    return ((value) < 0
     ? ((value) % (range) != 0 ? (value) % (range) + (range) : 0)
     : ((value) >= (range) ? (value) % (range) : (value)));
}

/****************************************************************************
 ...
****************************************************************************/
function XOR(a,b) {
  return ( a || b ) && !( a && b );
}

/****************************************************************************
 ...
****************************************************************************/
$.extend({
  getUrlVars: function(){
    var vars = [], hash;
    var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
    for(var i = 0; i < hashes.length; i++)
    {
      hash = hashes[i].split('=');
      vars.push(hash[0]);
      vars[hash[0]] = hash[1];
    }
    return vars;
  },
  getUrlVar: function(name){
    return $.getUrlVars()[name];
  }
});



var benchmark_start = 0;

/****************************************************************************
 Benchmark the Freeciv.net webclient.
****************************************************************************/
function civclient_benchmark(frame)
{

  if (frame == 0) benchmark_start = new Date().getTime();

  var ptile = map_pos_to_tile(frame+5, frame+5);
  center_tile_mapcanvas(ptile);

  if (frame < 30) {
    setTimeout("civclient_benchmark(" + (frame + 1) + ")", 10);
  } else {

    var end = new Date().getTime();
    var time = (end - benchmark_start) / 25;
    swal('Redraw time: ' + time);
  }
}

/****************************************************************************
 ...
****************************************************************************/
function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**************************************************************************
...
**************************************************************************/
function to_title_case(str)
{
  return str.replace(/\w\S*/g,
         function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}

/**************************************************************************
  Remove a string's translation qualifier.

  The Freeciv server qualifies some strings for translation purposes. The
  qualifiers shouldn't be shown to the user.
**************************************************************************/
function string_unqualify(str)
{
  if (str.charAt(0) == "?" && str.indexOf(":") != -1) {
    /* This string is qualified. Remove it. */
    return str.substr(str.indexOf(":") + 1);
  } else {
    /* This string isn't qualified. */
    return str;
  }
}

/**************************************************************************
...
**************************************************************************/
function get_random_int(min, max) {
  return Math.floor(fc_seedrandom() * (max - min)) + min;
}

/**************************************************************************
...
**************************************************************************/
function supports_mp3() {
  var a = document.createElement('audio');
  return !!(a.canPlayType && a.canPlayType('audio/mpeg;').replace(/no/, ''));
}

/****************************************************************************
  Mac OS X and Chrome OS does not support the right-click-and-drag to select
  units on the map in Freeciv-web at the moment.
****************************************************************************/
function is_right_mouse_selection_supported()
{
  if (is_touch_device() || platform.description.indexOf("Mac OS X") > 0 || platform.description.indexOf("Chrome OS") > 0
      || platform.description.indexOf("CrOS") > 0 ) {
    return false;
  } else {
    return true;
  }

}

/**************************************************************************
...
**************************************************************************/
function seconds_to_human_time(input_seconds) {
  if (input_seconds <= 0) return 0 + 's';
  var hours   = Math.floor(input_seconds / 3600);
  var minutes = Math.floor((input_seconds - (hours * 3600)) / 60);
  var seconds = input_seconds - (hours * 3600) - (minutes * 60);
  if (hours > 0) return hours+'h '+minutes+'m ';
  if (hours == 0 && minutes > 0) return minutes+'m '+seconds + 's';
  if (hours == 0 && minutes == 0) return seconds + 's';
}

/**************************************************************************
 Returns the supported file format for the tileset.
**************************************************************************/
function get_tileset_file_extention()
{
  return ".png";
}

/**************************************************************************
...
**************************************************************************/
function html_safe(text)
{
  text = text.replace(/'/g, "&#39;");
  text = text.replace(/"/g, "&#34;");
  text = text.replace(/[\x03]/g,"\n");
  return text;
}

/**************************************************************************
...
**************************************************************************/
function uncapitalize(s) {
  if (typeof s !== 'string') return "";
  return s.charAt(0).toLowerCase() + s.slice(1)
}

/**************************************************************************
...
**************************************************************************/
function cleaned_text(str)
{
  // Remove each type of ugly spurious character or escape code.
  for (var i = 0; i < STRIPCHAR_LAST; i++) {
    str = str.replace(stripChar[i],"");
  }
  return str;
}

/**************************************************************************
...
**************************************************************************/
function fractionalize(s) {

  if (s.toString().endsWith(".5")) s = ""+Math.trunc(s) + "&#189;";
  else if (s.toString().endsWith(".75")) s = "" + (Math.trunc(s) ? Math.trunc(s) : "") + "&#xBE;";
  else if (s.toString().endsWith(".25")) s = "" + (Math.trunc(s) ? Math.trunc(s) : "") + "&#xBC;";
  else if (s.toString().endsWith(".05")) s = "" + (Math.trunc(s) ? Math.trunc(s) : "") + "&#8203;1&#x2044;20";
  else if (s.toString().endsWith(".1")) s = "" + (Math.trunc(s) ? Math.trunc(s) : "") + "&#x2152;";

  return s;
}

/**************************************************************************
...
**************************************************************************/
function forceLower(strnput)
{
  strnput.value=strnput.value.toLowerCase();
}

/**************************************************************************
...
**************************************************************************/
function submit_game_of_the_day() {
 show_fps();
 setTimeout(submit_game_of_the_day2, 1500);

}

/**************************************************************************
...
**************************************************************************/
function submit_game_of_the_day2() {
 html2canvas(document.body).then(function(canvas) {
    var screenshot = canvas.toDataURL("image/png");
    $.post( "/save_game_of_the_day", screenshot);
  });
  show_fps();
}

/**************************************************************************
 JQuery isFunction replacement since they deprecated it.
**************************************************************************/
function isFunction(obj) {
  return typeof obj === 'function';
}

/**************************************************************************
 JQuery trim replacement since they deprecated it.
**************************************************************************/
function trim(str) {
    if (str == null) return null;
    return str.replace(/^\s+|\s+$/g, '');
}

/**************************************************************************
 JQuery isArray replacement since they deprecated it.
**************************************************************************/
function isArray(value) {
  return Array.isArray(value);
}