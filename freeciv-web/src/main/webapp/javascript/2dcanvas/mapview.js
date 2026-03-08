/**********************************************************************
    Freeciv-web - the web version of Freeciv. http://www.FreecivWorld.net/
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


var tileset_images = [];
var sprites = {};
var loaded_images = 0;

var sprites_init = false;

/* Separate sprite cache for the 2D map renderer (trident tileset for terrain/badges;
 * amplio2 unit sprites are drawn from the main sprites{} dict). */
var sprites_2d = {};
var sprites_2d_init = false;

var canvas_text_font = "16px Georgia, serif"; // with canvas text support

var fullfog = [];

var GOTO_DIR_DX = [0, 1, 2, -1, 1, -2, -1, 0];
var GOTO_DIR_DY = [-2, -1, 0, -1, 1, 0, 1, 2];

var mapview_slide = {};
mapview_slide['active'] = false;
mapview_slide['dx'] = 0;
mapview_slide['dy'] = 0;
mapview_slide['i'] = 0;
mapview_slide['max'] = 100;
mapview_slide['slide_time'] = 700;





/**************************************************************************
  This will load the tileset, blocking the UI while loading.
**************************************************************************/
function init_sprites()
{
  console.log("Preloading 2D canvas tileset images.");
  $(".container").remove();
  $("body").css("padding-top", "0px");
  $("body").css("padding-bottom", "0px");

  if (loaded_images != tileset_image_count) {
    var loadPromises = [];
    for (var i = 0; i < tileset_image_count; i++) {
      loadPromises.push(load_tileset_image(i));
    }
    Promise.all(loadPromises).then(function(images) {
      images.forEach(function(img, idx) { tileset_images[idx] = img; });
      loaded_images = tileset_image_count;
      init_cache_sprites();
      init_sprites_2d();
      webgl_preload();
    }).catch(function(err) {
      console.error("Failed to load tileset images: " + String(err));
    });
  } else {
    // already loaded
    webgl_preload();

  }

}

/**************************************************************************
  Returns a Promise that resolves to a loaded Image for tileset index i.
**************************************************************************/
function load_tileset_image(i)
{
  return new Promise(function(resolve, reject) {
    var img = new Image();
    img.onload = function() { resolve(img); };
    img.onerror = function() { reject("Error loading tileset image " + i); };
    img.src = '/tileset/freeciv-web-tileset-'
              + tileset_name + '-' + i + get_tileset_file_extention() + '?ts=' + ts;
  });
}

/**************************************************************************
  Determines when the whole tileset has been preloaded.
  Kept for backward compatibility.
**************************************************************************/
function preload_check()
{
  loaded_images += 1;

  if (loaded_images == tileset_image_count) {
    init_cache_sprites();
    webgl_preload();

  }
}

/**************************************************************************
  ...
**************************************************************************/
function init_cache_sprites()
{
 try {

  if (typeof tileset === 'undefined') {
    swal("Tileset not generated correctly. Run sync.sh in "
          + "freeciv-img-extract and recompile.");
    return;
  }

  var prefix = tileset_name + ".";
  for (var tile_tag in tileset) {
    /* Skip entries that don't belong to the active tileset */
    if (tile_tag.indexOf(prefix) !== 0) continue;

    var x = tileset[tile_tag][0];
    var y = tileset[tile_tag][1];
    var w = tileset[tile_tag][2];
    var h = tileset[tile_tag][3];
    var i = tileset[tile_tag][4];

    var newCanvas = document.createElement('canvas');
    newCanvas.height = h;
    newCanvas.width = w;
    var newCtx = newCanvas.getContext('2d');

    newCtx.drawImage(tileset_images[i], x, y,
                       w, h, 0, 0, w, h);
    // Strip tileset name prefix (e.g. "amplio2.") to cache with bare tags
    // for backward compatibility with code that looks up sprites by bare tag name.
    sprites[tile_tag.slice(prefix.length)] = newCanvas;

  }

  sprites_init = true;
  tileset_images[0] = null;
  tileset_images[1] = null;
  tileset_images = null;

 }  catch(e) {
  console.log("Problem caching sprite: " + tile_tag);
 }

}

/**************************************************************************
  ...
**************************************************************************/
function mapview_window_resized ()
{
  if (active_city != null || !resize_enabled) return;
  setup_window_size();

}


/**************************************************************************
  ...
**************************************************************************/
function mapview_put_tile(pcanvas, tag, canvas_x, canvas_y) {
  if (sprites[tag] == null) {
    //console.log("Missing sprite " + tag);
    return;
  }

  pcanvas.drawImage(sprites[tag], canvas_x, canvas_y);

}


/**************************************************************************
  ...
**************************************************************************/
function set_default_mapview_inactive()
{
  $("#game_unit_panel").parent().hide();
  if (chatbox_active) $("#game_chatbox_panel").parent().hide();
  if (command_center_active) $("#ai_intro_dialog").parent().hide();
  if (overview_active) $("#game_overview_panel").parent().hide();
  $("#tile_dialog").parent().hide();

}

/**************************************************************************
  Load the trident tileset image and populate sprites_2d for the 2D map.
**************************************************************************/
function init_sprites_2d()
{
  var cfg = tileset_confg['trident'];
  var img = new Image();
  img.onload = function() { _cache_sprites_2d(img); };
  img.onerror = function() { console.error("Failed to load trident tileset image."); };
  img.src = '/tileset/freeciv-web-tileset-' + cfg['name'] + '-0'
            + get_tileset_file_extention() + '?ts=' + ts;
}

/**************************************************************************
  Extract and cache all trident sprites into the sprites_2d dictionary.
**************************************************************************/
function _cache_sprites_2d(img)
{
  try {
    if (typeof tileset === 'undefined') return;
    var prefix = tileset_confg['trident']['name'] + '.';
    for (var tile_tag in tileset) {
      if (tile_tag.indexOf(prefix) !== 0) continue;
      var data = tileset[tile_tag];
      var newCanvas = document.createElement('canvas');
      newCanvas.width  = data[2];
      newCanvas.height = data[3];
      newCanvas.getContext('2d').drawImage(img, data[0], data[1],
                                           data[2], data[3],
                                           0, 0, data[2], data[3]);
      sprites_2d[tile_tag.slice(prefix.length)] = newCanvas;
    }
    sprites_2d_init = true;
    render_2d_map();
  } catch(e) {
    console.error("Error caching 2D trident sprites: " + e);
  }
}
