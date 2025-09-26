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


var LOG_FATAL = 0;
var LOG_ERROR = 1;		/* non-fatal errors */
var LOG_NORMAL = 2;
var LOG_VERBOSE = 3;		/* not shown by default */
var LOG_DEBUG = 4;		/* suppressed unless DEBUG defined;
				   may be enabled on file/line basis */



function freelog(level, message)
{

  console.log(message);

}

