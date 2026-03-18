/**********************************************************************
 Freeciv 3D - the web version of Freeciv. http://www.freecivx.com/
 Copyright (C) 2009-2024  The Freeciv-web project

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
 Returns a colored surplus value string (green if positive, red if negative).
 **************************************************************************/
function format_surplus(value)
{
    if (value > 0) {
        return "<span class='cities_surplus_pos'>+" + value + "</span>";
    } else if (value < 0) {
        return "<span class='cities_surplus_neg'>" + value + "</span>";
    }
    return "" + value;
}

/**************************************************************************
 Returns HTML for a production icon + name for use in the cities table.
 @param {City} pcity - The city to get production HTML for.
 @returns {string} HTML string containing the production icon and name.
 **************************************************************************/
function get_city_production_html(pcity)
{
    var prod_type = get_city_production_type(pcity);
    if (prod_type == null || prod_type['name'] == null) return "-";
    var sprite = get_city_production_type_sprite(pcity);
    var icon_html = "";
    if (sprite != null && sprite['sprite'] != null) {
        var s = sprite['sprite'];
        icon_html = "<div style='display:inline-block;background:transparent url("
            + s['image-src'] + ");background-position:-" + s['tileset-x'] + "px -"
            + s['tileset-y'] + "px;width:" + s['width'] + "px;height:" + s['height']
            + "px;vertical-align:middle;margin-right:4px;'></div>";
    }
    var turns_to_complete = get_city_production_time(pcity);
    var turns_str = (turns_to_complete == FC_INFINITY) ? "&infin;" : turns_to_complete + "t";
    return icon_html + "<span>" + prod_type['name'] + " (" + turns_str + ")</span>";
}

/**************************************************************************
 Updates the Cities tab when clicked, populating the table.
 **************************************************************************/
function update_city_screen()
{
    if (observing) return;

    var sortList = [];
    var headers = $('#city_table thead th');
    headers.filter('.tablesorter-headerAsc').each(function (i, cell) {
        sortList.push([cell.cellIndex, 0]);
    });
    headers.filter('.tablesorter-headerDesc').each(function (i, cell) {
        sortList.push([cell.cellIndex, 1]);
    });

    var city_list_html = "<table class='tablesorter' id='city_table' border=0 cellspacing=0>"
        + "<thead><tr><th>Name</th><th>Population</th><th>Size</th><th>State</th>"
        + "<th>Granary</th><th>Grows In</th><th>Producing</th>"
        + "<th>Surplus (Food/Prod/Trade)</th><th>Economy (Gold/Luxury/Science)</th></tr></thead><tbody>";
    var count = 0;
    for (var city_id in cities) {
        var pcity = cities[city_id];
        if (client.conn.playing != null && city_owner(pcity) != null && city_owner(pcity).playerno == client.conn.playing.playerno) {
            count++;
            var city_state = get_city_state(pcity);

            city_list_html += "<tr class='cities_row' id='cities_list_" + pcity['id']
                + "' data-city-id='" + pcity['id'] + "' data-city-name='" + pcity['name'].toLowerCase() + "'>"
                + "<td>" + pcity['name'] + "</td>"
                + "<td>" + numberWithCommas(city_population(pcity)*1000) + "</td>"
                + "<td>" + pcity['size'] + "</td>"
                + "<td class='" + (city_state === "Celebrating" ? "cities_state_celebrating" : city_state === "Disorder" ? "cities_state_disorder" : "") + "'>" + city_state + "</td>"
                + "<td>" + pcity['food_stock'] + "/" + pcity['granary_size'] + "</td>"
                + "<td>" + city_turns_to_growth_text(pcity) + "</td>"
                + "<td class='cities_production_cell'>" + get_city_production_html(pcity) + "</td>"
                + "<td>" + format_surplus(pcity['surplus'][O_FOOD]) + " / "
                    + format_surplus(pcity['surplus'][O_SHIELD]) + " / "
                    + format_surplus(pcity['surplus'][O_TRADE]) + "</td>"
                + "<td>" + pcity['prod'][O_GOLD] + " / " + pcity['prod'][O_LUXURY] + " / " + pcity['prod'][O_SCIENCE] + "</td>"
                + "</tr>";
        }
    }

    city_list_html += "</tbody></table>";
    $("#cities_list").html(city_list_html);

    $('#cities_list').off('mousedown.cities').on('mousedown.cities', '.cities_row', function(event){
        if (event.which == 1) {
            var cityId = $(this).data('city-id');
            show_city_dialog_by_id(cityId);
        }
    });

    if (count != 0) {
      $("#city_table").contextMenu({
        selector: '.cities_row',
        callback: function(key, options) {
          cities_choose_production(key, options, $(this).data('city-id'));
        },
        items: generate_cities_production_list()
      });
    }

    if (count == 0) {
      $("#cities_list").html("<div class='cities_empty_msg'><i class='fa fa-city'></i> No cities yet. Build new cities with Settlers.</div>");
    }

    $('#cities_scroll').css("height", $(window).height() - 200);

    $("#city_table").tablesorter({theme:"dark", sortList: sortList});

    $("#cities_heading").html("<i class='fa fa-city' aria-hidden='true'></i> ").append(document.createTextNode(count + " Cities"));

    /* Apply any existing filter value */
    var filter_val = $("#cities_filter_input").val();
    if (filter_val) {
        cities_apply_filter(filter_val);
    }
}

/**************************************************************************
...
**************************************************************************/
function generate_cities_production_list()
{
  var pcity = null;
  for (var city_id in cities) {
    var ncity = cities[city_id];
    if (client.conn.playing != null && city_owner(ncity) != null && city_owner(ncity).playerno == client.conn.playing.playerno) {
       pcity = ncity;
       break;
    }
  }

  var production_list = {};
  for (var unit_type_id in unit_types) {
    var punit_type = unit_types[unit_type_id];
        // TODO: should have unique check if each city can build the thing, not just check if the first city can build it.
    if (!can_city_build_now(pcity, VUT_UTYPE, punit_type['id'])) continue;

    if (punit_type['name'] == "Barbarian Leader" || punit_type['name'] == "Leader") continue;
      production_list[punit_type['name']] = {name: punit_type['name']}
  }

  for (var improvement_id in improvements) {
    var pimprovement = improvements[improvement_id];
    if (!can_city_build_now(pcity, VUT_IMPROVEMENT, pimprovement['id'])) continue;
    production_list[pimprovement['name']] = {name: pimprovement['name']}
  }
  return production_list;
}

/**************************************************************************
...
**************************************************************************/
function cities_choose_production(key, options, city_id) {
  var production_list = {};
  for (var unit_type_id in unit_types) {
    var punit_type = unit_types[unit_type_id];
    if (punit_type['name'] == key) {
        send_city_change(city_id, VUT_UTYPE, punit_type['id']);
    }
  }

  for (var improvement_id in improvements) {
    var pimprovement = improvements[improvement_id];
    if (pimprovement['name'] == key) {
        send_city_change(city_id, VUT_IMPROVEMENT, pimprovement['id']);
    }
  }
  setTimeout(update_city_screen, 250);
}

/**************************************************************************
 Filters the cities table rows by name.
 **************************************************************************/
function cities_apply_filter(filter_val)
{
    var val = filter_val.toLowerCase().trim();
    $('#city_table tbody tr').each(function() {
        var city_name = $(this).data('city-name') || "";
        $(this).toggle(city_name.indexOf(val) !== -1);
    });
}

/**************************************************************************
 Initializes the cities filter input handler. Called once on game start.
 **************************************************************************/
function init_cities_filter()
{
    $('#tabs-cities').off('input.cities_filter').on('input.cities_filter', '#cities_filter_input', function() {
        cities_apply_filter($(this).val());
    });
}