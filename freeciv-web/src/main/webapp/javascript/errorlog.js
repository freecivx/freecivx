/**********************************************************************
    FreecivX.net - the web version of Freeciv. https://www.FreecivX.net/
    Copyright (C) 2023 FreecivX.net

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


/**************************************************************************
 Logs JavaScript error in FreecivX.net DB.
**************************************************************************/
function errorlog_callback(stackframes)
{
    var stringifiedStack = stackframes.map(function(sf) {
        return sf.toString();
    }).join('\n');
    if (stringifiedStack != null && (stringifiedStack.indexOf("Failed to resolve module specifier") > 0 || stringifiedStack.indexOf("'three'") > 0)) return;

    $.post("/errorlog?stacktrace=" + utf8_to_b64(stringifiedStack + " " + window.navigator.userAgent)).fail(function() {});
    console.log(stringifiedStack);

}

/**************************************************************************
 Logs error message.
**************************************************************************/
function errback(err)
{
  console.log(err.message);
}


window.onerror = function(msg, file, line, col, error) {
    StackTrace.fromError(error).then(errorlog_callback).catch(errback);
    if (msg != null && (msg.indexOf("Failed to resolve module specifier") > 0 || msg.indexOf("'three'") > 0)) return;
    $.post("/errorlog?stacktrace=" + utf8_to_b64(msg + " " + window.navigator.userAgent)).fail(function() {});
};

function utf8_to_b64(str) {
  return window.btoa(unescape(encodeURIComponent(str)));
}
