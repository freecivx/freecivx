/**********************************************************************
    Freecivx.com - the web version of Freeciv. https://www.freecivx.com/
    Copyright (C) 2022 Freecivx.com

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

// CMA for Freecivx.com
// The governor algorithm runs entirely in JavaScript (see cm.js); no server
// round-trip is needed to optimise citizen placement.

var _cma_val_sliders = [1,0,0,0,0,0];
var _cma_min_sliders = [0,0,0,0,0,0];
var _cma_happy_slider = 0;
var _cma_celebrate = false;
var _cma_allow_disorder = false;
var _cma_no_farmer = false;
var _cma_allow_specialists = true;
var _cma_max_growth = false;


/**************************************************************************
Init Governor tab - returns true if the tab was able to generate
**************************************************************************/
function show_city_governor_tab()
{ // Reject cases which can't show the Governor: -----------------------------------------------
  if (client_is_observer() || client.conn.playing == null) return false;
  if (!active_city) return false;
  if (city_owner_player_id(active_city) != client.conn.playing.playerno) {
    $("#city_governor_tab").html("City Governor available only for domestic cities.");
    return false;
  }

  /* Read state from the JS-side cm_city_params store. */
  var state   = cm_city_params[active_city['id']];
  var enabled = state && state['enabled'];
  var param   = state && state['parameter'];

  $("#cma_food").prop('checked',    enabled && param && param['factor'][O_FOOD]    == 6);
  $("#cma_shield").prop('checked',  enabled && param && param['factor'][O_SHIELD]  == 6);
  $("#cma_trade").prop('checked',   enabled && param && param['factor'][O_TRADE]   == 6);
  $("#cma_gold").prop('checked',    enabled && param && param['factor'][O_GOLD]    == 6);
  $("#cma_luxury").prop('checked',  enabled && param && param['factor'][O_LUXURY]  == 6);
  $("#cma_science").prop('checked', enabled && param && param['factor'][O_SCIENCE] == 6);
}

/**************************************************************************
  Applies new CMA parameters from the UI, stores them locally, and runs
  the JS governor immediately.  No server call is made for the optimisation
  itself; only tile-assignment packets (make_worker / make_specialist) are
  sent once the best layout has been computed.
**************************************************************************/
function request_new_cma(city_id)
{
  var cm_parameter = {};

  _cma_val_sliders[O_FOOD]    = $("#cma_food").prop('checked')    ? 6 : 0;
  _cma_val_sliders[O_SHIELD]  = $("#cma_shield").prop('checked')  ? 6 : 0;
  _cma_val_sliders[O_TRADE]   = $("#cma_trade").prop('checked')   ? 6 : 0;
  _cma_val_sliders[O_GOLD]    = $("#cma_gold").prop('checked')    ? 6 : 0;
  _cma_val_sliders[O_LUXURY]  = $("#cma_luxury").prop('checked')  ? 6 : 0;
  _cma_val_sliders[O_SCIENCE] = $("#cma_science").prop('checked') ? 6 : 0;

  cm_parameter['minimal_surplus']  = [..._cma_min_sliders];
  cm_parameter['require_happy']    = _cma_celebrate;
  cm_parameter['allow_disorder']   = _cma_allow_disorder;
  cm_parameter['max_growth']       = _cma_no_farmer;
  cm_parameter['allow_specialists'] = _cma_allow_specialists;
  cm_parameter['factor']           = [..._cma_val_sliders];
  cm_parameter['happy_factor']     = _cma_happy_slider;

  var cma_disabled = (_cma_val_sliders[O_FOOD]   === 0
                   && _cma_val_sliders[O_SHIELD]  === 0
                   && _cma_val_sliders[O_TRADE]   === 0
                   && _cma_val_sliders[O_GOLD]    === 0
                   && _cma_val_sliders[O_LUXURY]  === 0
                   && _cma_val_sliders[O_SCIENCE] === 0);

  if (cma_disabled) {
    /* Governor disabled: clear local state. */
    delete cm_city_params[city_id];
  } else {
    /* Store parameter and run the governor immediately. */
    cm_city_params[city_id] = { enabled: true, parameter: cm_parameter };
    var pcity = cities[city_id];
    if (pcity) {
      var result = cm_query_result(pcity, cm_parameter);
      if (result && result.found_a_valid) {
        cm_apply_result(pcity, result);
      }
    }
  }
}

/**************************************************************************
  Called when user clicks button to Enable/Disable governor.
**************************************************************************/
function button_pushed_toggle_cma() {
  request_new_cma(active_city['id']);
}