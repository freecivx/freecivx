/**********************************************************************
    FreecivWorld.net - the web version of Freeciv. https://www.FreecivWorld.net/
    Copyright (C) 2023 FreecivWorld.net

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
 Logs JavaScript error in FreecivWorld.net DB.
**************************************************************************/
function reportError(error, msg) {
    // Use native Error.stack for strict mode compatibility
    var stackTrace = '';
    
    if (error && error.stack) {
        stackTrace = error.stack;
    } else if (msg) {
        // Create a stack trace from the message if error object is not available
        stackTrace = msg;
    }
    
    // Filter out known non-critical errors
    if (stackTrace && (stackTrace.indexOf("Failed to resolve module specifier") > 0 || stackTrace.indexOf("'three'") > 0)) {
        return;
    }
    
    var errorInfo = stackTrace + " " + window.navigator.userAgent;
    $.post("/errorlog?stacktrace=" + utf8_to_b64(errorInfo)).fail(function() {});
    console.log(stackTrace);
}


window.onerror = function(msg, file, line, col, error) {
    // Use native error handling - strict mode compatible
    reportError(error, msg + " at " + file + ":" + line + ":" + col);
};

function utf8_to_b64(str) {
  return window.btoa(unescape(encodeURIComponent(str)));
}
