/**********************************************************************
    FreecivX.net - the 3D web version of Freeciv. https://www.FreecivX.net/
    Copyright (C) 2009-2017  The Freeciv-web project

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


/****************************************************************************
 Create a unit label, flag, action sprite
****************************************************************************/
function create_unit_label_sprite(punit, ptile)
{
  let pflag = get_unit_nation_flag_sprite(punit);
  var activities = get_unit_activity_sprite(punit);
  var hp = punit['hp'];
  var unit_type = unit_types[punit['type']];
  var max_hp = unit_type['hp'];
  var healthpercent = 10 * Math.floor((10 * hp) / max_hp);
  let key = pflag['key'] + (activities != null ? activities.key : "") + tile_units(ptile).length + healthpercent + unit_type['graphic_str'] + get_unit_activity_text(punit);

  var texture;
  if (texture_cache[key] != null) {
    texture = texture_cache[key];
  } else {
    var width = 0;
    var fcanvas = document.createElement("canvas");
    fcanvas.width = 100;
    fcanvas.height = 32;
    var ctx = fcanvas.getContext("2d");

    ctx.drawImage(sprites[pflag['key']], 0, 0,
                sprites[pflag['key']].width, sprites[pflag['key']].height,
                0,6,40,20);
    width += 45;


    if (show_unit_in_label && punit.owner != null) {
      let unit_sprite = sprites[unit_type['graphic_str'] + "_Idle"];
      var owner_id = punit.owner;
      var owner = players[owner_id];
      var background_color = nations[owner.nation].color;
      let rectWidth = unit_sprite.width * 0.5;
      let rectHeight = unit_sprite.height * 0.5;

      ctx.fillStyle = background_color;
      ctx.fillRect(width + 3, 2, rectWidth - 5, rectHeight - 4);

      ctx.drawImage(unit_sprite, 0, 0,
          unit_sprite.width, unit_sprite.height,
          width, 0, unit_sprite.width * 0.5, unit_sprite.height * 0.5);
      width += 33;
    }

    ctx.font = 'bold 18px serif';

    if (activities != null) {
      ctx.drawImage(sprites[activities.key],
          0, 0,
          28, 28,
          width, -5, 32, 32);
      width += 30;
    }
    var activity_txt = get_unit_activity_text(punit);
    if (activity_txt == "A") {
      let txt = activity_txt;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.strokeText(txt, width + 6, 15);
      ctx.fillStyle = '#ffe800';
      ctx.fillText(txt, width + 6, 15);
      width += 30;
    }

    if (tile_units(ptile).length > 1) {
      let txt = "" + tile_units(ptile).length;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.strokeText(txt, width + 5, 15);
      ctx.fillStyle = '#ffe800';
      ctx.fillText(txt, width + 5, 15);
      width += 30;
    }

    if (punit['veteran'] > 0) {
      ctx.drawImage(sprites["unit.vet_" + punit['veteran']],
          24, 24,
          24, 24,
          width - 10, -10, 36, 36);
    }

    ctx.drawImage(sprites["unit.hp_" + healthpercent], 25, 10,
        22, 7,
        0,0,40,6);


    texture = new THREE.Texture(fcanvas);
    texture.needsUpdate = true;
    texture_cache[key] = texture;
  }

  var sprite = new THREE.Sprite( new THREE.SpriteMaterial( { map: texture}));
  sprite.scale.set(28,16,1);
  return sprite;
}


/****************************************************************************
 Create a city label sprite
****************************************************************************/
function create_city_label_sprite(pcity, index) {
  var fcanvas = document.createElement("canvas");
  fcanvas.width = 390;
  fcanvas.height = 35;
  var ctx = fcanvas.getContext("2d");
  pcity['label_canvas' + index] = fcanvas;

  var owner_id = pcity.owner;
  if (owner_id == null) return null;
  var owner = players[owner_id];

  // We draw from left to right, updating `width' after each call.
  var width = 0; // Total width of the bar

  // Flag
  var city_gfx = get_city_flag_sprite(pcity);
  ctx.drawImage(sprites[city_gfx.key],
      0, 0,
      sprites[city_gfx.key].width, sprites[city_gfx.key].height,
      0, 0, 48, 32);
  width += 48;

  // Occupied
  var ptile = city_tile(pcity);
  var punits = tile_units(ptile);
  if (punits.length > 0) {
    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(width, 0, 16, 32);
    // Stars
    ctx.drawImage(sprites[get_city_occupied_sprite(pcity)], width, 0, 13, 32);
    width += 13;
  }

  // Name and size
  var city_text = pcity.name.toUpperCase() + " " + pcity.size;
  ctx.font = webgl_mapview_font;
  var txt_measure = ctx.measureText(city_text);
  // Background with brighter overlay
  var background_color = nations[owner.nation].color;
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)"; // Transparent black overlay
  ctx.fillRect(width, 0, txt_measure.width + 11 /* padding */, 32);

  ctx.fillStyle = '#FFFFFF'; // Set text color to white
  ctx.fillText(city_text, width + 4 /* padding */, 13 * 2);
  width += txt_measure.width + 11 /* padding */;


  // Production
  var prod_type = get_city_production_type(pcity);
  if (prod_type != null) {
    var tag = tileset_ruleset_entity_tag_str_or_alt(prod_type, "unit or building");
    if (tag != null) {
      ctx.fillStyle = background_color;
      ctx.fillRect(width, 0, 36, 32);
      ctx.drawImage(sprites[tag], width, 0, 34, 18 * 2);
      width += 35;
    }
  }
  if (width > 380) width = 380;

  // Outline with enhanced contrast
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#FFFFAA'; // Slightly brighter border color
  ctx.strokeRect(0, 0, width, fcanvas.height - 3);

  texture = new THREE.Texture(fcanvas);
  texture.needsUpdate = true;
  var key = 'city_' + pcity['id'] + index;
  texture_cache[key] = texture;

  // Create material with emissive intensity
  var material = new THREE.SpriteMaterial({ map: texture });
  material.emissive = new THREE.Color(0xFFFFFF); // White emissive color
  material.emissiveIntensity = 2.0; // Brighter emissive intensity

  var sprite = new THREE.Sprite(material);
  sprite.scale.set(width * 0.42 + 10, 9.5, 1);
  return sprite;
}


/****************************************************************************
 Update a city name label. This updates the canvas image of the city label,
 which then updates the corresponding Three.js Texture.
****************************************************************************/
function update_city_label(pcity, index)
{
  var canvas = pcity['label_canvas' + index];
  if (canvas == null) {
    canvas = document.createElement('canvas');
    canvas.width = 390;
    canvas.height = 35;
    pcity['label_canvas'] = canvas;
  }

  var ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  var owner_id = pcity.owner;
  if (owner_id == null) return null;
  var owner = players[owner_id];

  // We draw from left to right, updating `width' after each call.
  var width = 0; // Total width of the bar

  // Flag
  var city_gfx = get_city_flag_sprite(pcity);
  ctx.drawImage(sprites[city_gfx.key],
                0, 0,
                sprites[city_gfx.key].width, sprites[city_gfx.key].height,
                0, 0, 48, 32);
  width += 48;

  // Occupied
  var ptile = city_tile(pcity);
  var punits = tile_units(ptile);
  if (punits.length > 0) {
    // Background
    ctx.fillStyle = 'black';
    ctx.fillRect(width, 0, 16, 32);
    // Stars
    ctx.drawImage(sprites[get_city_occupied_sprite(pcity)], width, 0, 13, 32);
    width += 13;
  }

  // Name and size
  var city_text = pcity.name.toUpperCase() + " " + pcity.size;
  ctx.font = webgl_mapview_font;
  var txt_measure = ctx.measureText(city_text);
  // Background
  var background_color = nations[owner.nation].color;
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(width, 0, txt_measure.width + 11 /* padding */, 32);
  // Text
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(city_text, width + 4 /* padding */, 13*2);

  width += txt_measure.width + 11 /* padding */;

  // Production
  var prod_type = get_city_production_type(pcity);
  if (prod_type != null) {
    var tag = tileset_ruleset_entity_tag_str_or_alt(prod_type, "unit or building");
    if (tag != null) {
      ctx.fillStyle = background_color;
      ctx.fillRect(width, 0, 36, 32);
      ctx.drawImage(sprites[tag], width, 0, 34, 18*2);
      width += 35;
    }
  }

  ctx.lineWidth = 2;
  ctx.strokeStyle = background_color;
  ctx.strokeRect(0, 0, width, canvas.height - 3);

  var key = 'city_' + pcity['id'] + index;
  if (key in texture_cache) {
    var texture = texture_cache[key];
    if (texture != null) {
      texture.needsUpdate = true;
    }
  }
}


/****************************************************************************
 Create a city worked sprite
****************************************************************************/
function create_city_worked_sprite(food, shields, trade) {
  var key = food.toString() + shields.toString() + trade.toString();

  var texture;
  if (texture_cache[key] != null) {
    texture = texture_cache[key];
  } else {

    var fcanvas = document.createElement("canvas");
    fcanvas.width = 64;
    fcanvas.height = 32;
    var ctx = fcanvas.getContext("2d");

    // Add a border around the canvas
    ctx.strokeStyle = "black";  // border color
    ctx.lineWidth = 8;  // border width
    ctx.strokeRect(0, 0, fcanvas.width, fcanvas.height);

    ctx.fillStyle = "#00FF00";
    ctx.fillRect(0, 0, 20, 32);
    ctx.fillStyle = "black";
    ctx.font = "18px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(food.toString(), 10, 16);

    ctx.fillStyle = "white";
    ctx.fillRect(20, 0, 22, 32);
    ctx.fillStyle = "black";  // text color
    ctx.fillText(shields.toString(), 31, 16);

    ctx.fillStyle = "yellow";
    ctx.fillRect(42, 0, 22, 32);
    ctx.fillStyle = "black";
    ctx.fillText(trade.toString(), 53, 16);

    texture = new THREE.Texture(fcanvas);
    texture.needsUpdate = true;
    texture_cache[key] = texture;
  }

  var sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture }));
  sprite.scale.set(24, 8, 1);
  return sprite;
}



/****************************************************************************
 Create a unit explosion sprite (frame = [0-4].
****************************************************************************/
function create_unit_explosion_sprite(frame)
{
  var texture;
  var key = 'explode.unit_' + frame;

  if (texture_cache[key] != null) {
    texture = texture_cache[key];
  } else {
    var fcanvas = document.createElement("canvas");
    fcanvas.width = 32;
    fcanvas.height = 32;
    var fcontext = fcanvas.getContext("2d");
    fcontext.drawImage(sprites[key], 0, 0,
                sprites[key].width, sprites[key].height,
                0,0,32,32);
    texture = new THREE.Texture(fcanvas);
    texture.needsUpdate = true;
    texture_cache[key] = texture;
  }

  var sprite = new THREE.Sprite( new THREE.SpriteMaterial( { map: texture}));
  sprite.scale.set(32,32,1);
  return sprite;
}

/****************************************************************************
 Create a city civil disorder sprite
****************************************************************************/
function create_city_disorder_sprite()
{
  var sprite = new THREE.Sprite( new THREE.SpriteMaterial( { map: webgl_textures['city_disorder']}));
  sprite.scale.set(50,50,1);
  return sprite;
}


/****************************************************************************
 Create a tile label sprite
****************************************************************************/
function create_tile_label_sprite(label_text)
{
  var fcanvas = document.createElement("canvas");
  fcanvas.width = 350;
  fcanvas.height = 35;
  var ctx = fcanvas.getContext("2d");


  // Name and size
  ctx.font = webgl_mapview_font;
  var txt_measure = ctx.measureText(label_text);

  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(label_text, 2, 13*2);

  texture = new THREE.Texture(fcanvas);
  texture.needsUpdate = true;

  var sprite = new THREE.Sprite( new THREE.SpriteMaterial( { map: texture}));
  sprite.scale.set(Math.floor(txt_measure.width) + 5, 11, 1);
  return sprite;
}

/****************************************************************************
 Create stars texture.
****************************************************************************/
function create_star_sky_texture(num_stars, width, height, full) {
    var canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	var ctx = canvas.getContext('2d');
	ctx.fillStyle="black";
	ctx.fillRect(0, 0, width, height);
	for (var i = 0; i < num_stars; ++i) {
		var radius = Math.random() * 0.80;
		var x = Math.floor(Math.random() * width);
		var y = Math.floor(Math.random() * height);
		if (!full && y > height * 0.6) continue;

		ctx.beginPath();
		ctx.arc(x, y, radius, 0, 2 * Math.PI, false);
		ctx.fillStyle = 'rgb(' + (255 - (Math.random() * 80) + (Math.random() * 20)) +  ','  + (255 - (Math.random() * 80) + (Math.random() * 20))  + ' , ' + (220 - (Math.random() * 80)) + ')';
		ctx.fill();
	}

	var texture = new THREE.Texture(canvas);
	texture.needsUpdate = true;
	return texture;
}

/**********************************************************************
 ...
 ***********************************************************************/
function get_unit_nation_flag_sprite(punit)
{
  var owner_id = punit['owner'];
  var owner = players[owner_id];
  var nation_id = owner['nation'];
  var nation = nations[nation_id];

  return {"key" : "f.shield." + nation['graphic_str']};
}