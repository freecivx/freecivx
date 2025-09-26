/**********************************************************************
    Freeciv-web - the web version of Freeciv. http://www.FreecivX.net/
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

var webgl_textures = {};
var webgl_models = {};
var total_model_count = 0;
var load_count = 0;

var model_filenames_initial = ["Settlers",   "Explorer",   "Workers", "city_european_0",  "city_modern_0", "city_roman_0",  "city_babylonian_0", "city_chinese_0", "Warriors", "citywalls_stone", "citywalls_roman",
                               "Cactus1", "Palm1", "Palm2", "Pine1", "Pine3", "Tree1", "Tree2", "Tree3", "Fish1", "Fish2", "Fish3", "Whales", "Wheat"];
var tiles_of_unloaded_models_map = {};
var models_loading_map = {}; // used to keep track of which models are loading, to prevent loading the same models multiple times.

var loader;

/****************************************************************************
  Preload textures and models
****************************************************************************/
function webgl_preload()
{
  show_splash_screen();

  loader = new GLTFLoader();
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath( '/javascript/webgl/libs/' );
  dracoLoader.setDecoderConfig( { type: 'js' } );
  loader.setDRACOLoader(dracoLoader);

  var loadingManager = new THREE.LoadingManager();
  loadingManager.onLoad = function () {
    webgl_preload_models();
  };

  var textureLoader = new THREE.ImageLoader( loadingManager );

  var disorder_sprite = new THREE.Texture();
  webgl_textures["city_disorder"] = disorder_sprite;
  textureLoader.load( '/textures/city_civil_disorder.png', function ( image ) {
      disorder_sprite.image = image;
      disorder_sprite.needsUpdate = true;
  } );

  for (var i = 0; i < tiletype_terrains.length ; i++) {
    var terrain_name = tiletype_terrains[i];
    textureLoader.load("/textures/large/" + terrain_name + ".png", handle_new_texture("/textures/large/" + terrain_name + ".png", terrain_name));
  }


  /* Preload road textures. */
  var imgurl = "/textures/large/roads.png";
  textureLoader.load(imgurl, (function () {
          return function (image) {
                $("#download_progress").html(" road textures 15%");
                webgl_textures["roads"] = new THREE.Texture();
                webgl_textures["roads"].image = image;
                webgl_textures["roads"].wrapS = THREE.RepeatWrapping;
                webgl_textures["roads"].wrapT = THREE.RepeatWrapping;
                webgl_textures["roads"].magFilter = THREE.LinearFilter;
                webgl_textures["roads"].minFilter = THREE.LinearFilter;
                webgl_textures["roads"].needsUpdate = true;
            }
    })()
  );

  /* Preload railroads textures. */
  imgurl = "/textures/large/railroads.png";
  textureLoader.load(imgurl, (function () {
          return function (image) {
                $("#download_progress").html(" railroad textures 25%");
                webgl_textures["railroads"] = new THREE.Texture();
                webgl_textures["railroads"].image = image;
                webgl_textures["railroads"].wrapS = THREE.RepeatWrapping;
                webgl_textures["railroads"].wrapT = THREE.RepeatWrapping;
                webgl_textures["railroads"].magFilter = THREE.LinearFilter;
                webgl_textures["railroads"].minFilter = THREE.LinearFilter;
                webgl_textures["railroads"].needsUpdate = true;
            }
    })()
  );

  var city_light = new THREE.Texture();
  webgl_textures["city_light"] = city_light;
  textureLoader.load( '/textures/city_light.png', function ( image ) {
      city_light.image = image;
      city_light.needsUpdate = true;
  } );

  var nuke_grey_blast_area = new THREE.Texture();
  webgl_textures["nuke_grey_blast_area"] = nuke_grey_blast_area;
  textureLoader.load( '/textures/nuke_grey_blast_area.png', function ( image ) {
      nuke_grey_blast_area.image = image;
      nuke_grey_blast_area.needsUpdate = true;
  } );

  var nuke_inner_mushroom_cloud = new THREE.Texture();
  webgl_textures["nuke_inner_mushroom_cloud"] = nuke_inner_mushroom_cloud;
  textureLoader.load( '/textures/nuke_inner_mushroom_cloud.png', function ( image ) {
      nuke_inner_mushroom_cloud.image = image;
      nuke_inner_mushroom_cloud.needsUpdate = true;
  } );

  var nuke_outer_mushroom_cloud = new THREE.Texture();
  webgl_textures["nuke_outer_mushroom_cloud"] = nuke_outer_mushroom_cloud;
  textureLoader.load( '/textures/nuke_outer_mushroom_cloud.png', function ( image ) {
      nuke_outer_mushroom_cloud.image = image;
      nuke_outer_mushroom_cloud.needsUpdate = true;
  } );

  var nuke_hot_mushroom_cloud = new THREE.Texture();
  webgl_textures["nuke_hot_mushroom_cloud"] = nuke_hot_mushroom_cloud;
  textureLoader.load( '/textures/nuke_hot_mushroom_cloud.png', function ( image ) {
      nuke_hot_mushroom_cloud.image = image;
      nuke_hot_mushroom_cloud.needsUpdate = true;
  } );

  var nuke_rising_column = new THREE.Texture();
  webgl_textures["nuke_rising_column"] = nuke_rising_column;
  textureLoader.load( '/textures/nuke_rising_column.png', function ( image ) {
      nuke_rising_column.image = image;
      nuke_rising_column.needsUpdate = true;
  } );

  var nuke_shock_wave = new THREE.Texture();
  webgl_textures["nuke_shock_wave"] = nuke_shock_wave;
  textureLoader.load( '/textures/nuke_shock_wave.png', function ( image ) {
      nuke_shock_wave.image = image;
      nuke_shock_wave.needsUpdate = true;
  } );

  var nuke_glow = new THREE.Texture();
  webgl_textures["nuke_glow"] = nuke_glow;
  textureLoader.load( '/textures/nuke_glow.png', function ( image ) {
      nuke_glow.image = image;
      nuke_glow.needsUpdate = true;
  } );

  imgurl = '/textures/sky.jpg';
  textureLoader.load(imgurl, (function () {
          return function (image) {
                webgl_textures["skybox"] = new THREE.Texture();
                webgl_textures["skybox"].image = image;
                webgl_textures["skybox"].wrapS = THREE.RepeatWrapping;
                webgl_textures["skybox"].wrapT = THREE.RepeatWrapping;
                webgl_textures["skybox"].magFilter = THREE.LinearFilter;
                webgl_textures["skybox"].minFilter = THREE.LinearFilter;
                webgl_textures["skybox"].needsUpdate = true;
            }
    })()
  );

  imgurl =  '/textures/Water_1_M_Normal.jpg';
  textureLoader.load(imgurl, (function () {
        return function (image) {
          webgl_textures["water1"] = new THREE.Texture();
          webgl_textures["water1"].image = image;
          webgl_textures["water1"].wrapS = THREE.RepeatWrapping;
          webgl_textures["water1"].wrapT = THREE.RepeatWrapping;
          webgl_textures["water1"].magFilter = THREE.LinearFilter;
          webgl_textures["water1"].minFilter = THREE.LinearFilter;
          webgl_textures["water1"].needsUpdate = true;
        }
      })()
  );

  imgurl =  '/textures/Water_2_M_Normal.jpg';
  textureLoader.load(imgurl, (function () {
        return function (image) {
          webgl_textures["water2"] = new THREE.Texture();
          webgl_textures["water2"].image = image;
          webgl_textures["water2"].wrapS = THREE.RepeatWrapping;
          webgl_textures["water2"].wrapT = THREE.RepeatWrapping;
          webgl_textures["water2"].magFilter = THREE.LinearFilter;
          webgl_textures["water2"].minFilter = THREE.LinearFilter;
          webgl_textures["water2"].needsUpdate = true;
        }
      })()
  );

}

/****************************************************************************
  ...
****************************************************************************/
function handle_new_texture(url, terrain_name)
{
  return function (image) {
                var texture = new THREE.Texture();
                texture.image = image;
                texture.wrapS = THREE.RepeatWrapping;
                texture.wrapT = THREE.RepeatWrapping;
                texture.magFilter = THREE.LinearFilter;
                texture.minFilter = THREE.LinearFilter;
                texture.needsUpdate = true;
                webgl_textures[terrain_name] = texture;
  }
}

/****************************************************************************
  Preload all models.
****************************************************************************/
function webgl_preload_models()
{
  total_model_count = model_filenames_initial.length;
  for (var i = 0; i < model_filenames_initial.length; i++) {
    load_model(model_filenames_initial[i]);
  }
}

/****************************************************************************
 Load glTF (binary .glb) model from the server and import is as a model mesh.
****************************************************************************/
function load_model(filename)
{

  var url = "/gltf/" + filename + ".glb";

  loader.load( url, function(data) {
    var model = data.scene;

    model['name'] = filename;

    model.traverse((node) => {
      if (node.isMesh) {
        node.material.flatShading = false;
        node.material.side = THREE.DoubleSide;
        node.material.needsUpdate = true;
        node.geometry.computeVertexNormals();

        if (filename == "Oasis" && node['name'] == "Groundlow") {
          node.material.opacity = 0.7;
          node.material.transparent = true;
        }
        if (filename == "Wheat" ) {
          node.material.emissive.set(0xEEDC82);
          node.material.emissiveIntensity = 1.6;
        }
        if (filename == "city_european_0" || filename == "city_european_1" || filename == "city_european_2" || filename == "city_european_3" || filename == "city_european_4") {
          node.material.emissive.set(0x999999);
          node.material.emissiveIntensity = 0.3;
        }
        if (filename == "Oasis") {
          node.castShadow = false;
          node.material.emissive.set(0xFFFFFF);
          node.material.emissiveIntensity = 0.15;
        }
        if (filename == "Hut" ) {
          node.material.emissive.set(0xFFFFFF);
          node.material.emissiveIntensity = 0.15;
        }

        node.castShadow = true;
      }
    });

var modelscale = 12;
switch (filename) {
  case 'Horsemen':
  case 'Knights':
    modelscale = 10;
    break;
  case 'Cavalry':
    modelscale = 8.1;
    break;
  case 'Trireme':
    modelscale = 3.9;
    break;
  case 'Armor':
    modelscale = 5.8;
    break;
  case 'Helicopter':
    modelscale = 8.2;
    break;
  case 'Alpine Troops':
    modelscale = 10.0;
    break;
  case 'Diplomat':
    modelscale = 8.8;
    break;
  case 'Spy':
    modelscale = 2.7;
    break;
  case 'Cannon':
    modelscale = 3.0;
    break;
  case 'Artillery':
    modelscale = 3.4;
    break;
  case 'Transport':
    modelscale = 1.0;
    break;
  case 'Catapult':
    modelscale = 2.1;
    break;
  case 'OilWell':
    modelscale = 2.4;
    break;
  case 'Howitzer':
    modelscale = 8;
    break;
  case 'Freight':
    modelscale = 8;
    break;
  case 'Mech. Inf.':
    modelscale = 5.5;
    break;
  case 'Caravel':
    modelscale = 7;
    break;
  case 'Caravan':
    modelscale = 10;
    break;
  case 'Carrier':
    modelscale = 0.85;
    break;
  case 'Workers':
    modelscale = 8;
    break;
  case 'Explorer':
    modelscale = 9.0;
    break;
  case 'Chariot':
    modelscale = 6;
    break;
  case 'Warriors':
    modelscale = 10;
    break;
  case 'Fighter':
    modelscale = 8;
    break;
  case 'Legion':
    modelscale = 7;
    break;
  case 'Cactus1':
    modelscale = 44;
    break;
  case 'Fish1':
    modelscale = 1.8;
    break;
  case 'Fish2':
  case 'Fish3':
    modelscale = 1.3;
    break;
  case 'Whales':
    modelscale = 1.55;
    break;
  case 'Hut':
    modelscale = 8;
    break;
  case 'Mine':
    modelscale = 13;
    break;
  case 'Windmill':
    modelscale = 0.95;
    break;
  case 'Oil':
    modelscale = 15;
    break;
  case 'Zeppelin':
    modelscale = 6.2;
    break;
  case 'Peat':
    modelscale = 5.5;
    break;
  case 'Pyramids':
    modelscale = 4.2;
    break;
  case 'HangingGardens':
    modelscale = 3.1;
    break;
  case 'StatueOfLiberty':
    modelscale = 5.4;
    break;
  case 'EiffelTower':
    modelscale = 8;
    break;
  case 'GreatLibrary':
    modelscale = 3;
    break;
  case 'JSBachsCathedral':
    modelscale = 1.8;
    break;
  case 'SunTzusWarAcademy':
    modelscale = 5;
    break;
  case 'IsaacNewtonsCollege':
    modelscale = 3.6;
    break;
  case 'Crusaders':
    modelscale = 5;
    break;
  case 'NuclearPlant':
    modelscale = 4;
    break;
  case 'Buoy':
    modelscale = 1.8;
    break;
  case 'Migrants':
    modelscale = 10.0;
    break;
  case 'Partisan':
    modelscale = 11.0;
    break;
  case 'Fanatics':
    modelscale = 10.2;
    break;
  case 'Elephants':
    modelscale = 4;
    break;
  case 'Harbor':
    modelscale = 1.0;
    break;
  case 'Airport':
    modelscale = 1.8;
    break;
  case 'Lighthouse':
    modelscale = 4.3;
    break;
  case 'Iron':
    modelscale = 9;
    break;
  case 'Furs':
    modelscale = 4;
    break;
  case 'Gems':
    modelscale = 1.5;
    break;
  case 'Coal':
    modelscale = 8;
    break;
  case 'Fruit':
    modelscale = 3;
    break;
  case 'Silk':
    modelscale = 2.5;
    break;
  case 'Resources':
    modelscale = 3.5;
    break;
  case 'Fallout':
    modelscale = 6;
    break;
  case 'Pollution':
    modelscale = 1.5;
    break;
  case 'Gold':
    modelscale = 9;
    break;
  case 'Spice':
    modelscale = 9;
    break;
  case 'Game':
    modelscale = 2.8;
    break;
  case 'Ivory':
    modelscale = 6;
    break;
  case 'Wine':
    modelscale = 20.0;
    break;
  case 'Buffalo':
    modelscale = 1.8;
    break;
  case 'Cattle1':
  case 'Cattle2':
    modelscale = 2.0;
    break;
  case 'Pheasant':
    modelscale = 1.0;
    break;
  case 'Wheat':
    modelscale = 1.9;

    break;
  case 'Galleon':
    modelscale = 4.4;
    break;
  case 'Frigate':
    modelscale = 5.3;
    break;
  case 'AEGIS Cruiser':
     modelscale = 1.6;
     break;
  case 'Stealth Bomber':
     modelscale = 10;
     break;
  case 'Bomber':
    modelscale = 9.5;
    break;
  case 'Stealth Fighter':
     modelscale = 10;
     break;
  case 'Destroyer':
    modelscale = 0.90;
    break;
  case 'Battleship':
    modelscale = 1.20;
    break;
  case 'Cruiser':
    modelscale = 0.85;
    break;
  case 'Fortress':
    modelscale = 2.0;
    break;
  case 'Airbase':
    modelscale = 6.0;
    break;
  case 'Engineers':
    modelscale = 4.6;
    break;
  case 'Nuclear':
  case 'Settlers':
    modelscale = 4.0;
    break;
  case 'Spaceship':
  case 'Spaceship_launched':
    modelscale = 3.3;
    break;
  case 'Ironclad':
    modelscale = 2.9;
    break;
  case 'city_roman_0':
  case 'city_roman_1':
  case 'city_roman_2':
  case 'city_roman_3':
  case 'city_roman_4':
    modelscale = 2.1;
    break;
  case 'city_roman_capital':
    modelscale = 1.9;
    break;
  case 'city_european_1':
    modelscale = 2.9;
    break;
  case 'city_european_0':
  case 'city_european_2':
  case 'city_european_3':
  case 'city_european_4':
    modelscale = 2.5;
    break;
  case 'city_european_industrial_0':
  case 'city_european_industrial_1':
  case 'city_european_industrial_2':
  case 'city_european_industrial_3':
  case 'city_european_industrial_4':
    modelscale = 12;
    break;
  case 'city_postmodern_0':
  case 'city_postmodern_1':
  case 'city_postmodern_2':
  case 'city_postmodern_3':
  case 'city_postmodern_4':
    modelscale = 19.1;
    break;
  case 'city_babylonian_0':
  case 'city_babylonian_1':
  case 'city_babylonian_2':
    modelscale = 2.05;
    break;
  case 'city_babylonian_3':
  case 'city_babylonian_4':
    modelscale = 1.96;
    break;
  case 'city_chinese_0':
  case 'city_chinese_1':
  case 'city_chinese_2':
  case 'city_chinese_3':
  case 'city_chinese_4':
    modelscale = 1.78;
    break;
  case 'city_modern_1':
  case 'city_modern_2':
    modelscale = 8;
    break;
  case 'city_modern_3':
  case 'city_modern_4':
    modelscale = 9;
    break;
  case 'Ruins':
    modelscale = 7;
    break;
  case 'Library':
    modelscale = 2.4;
    break;
  case 'Temple':
    modelscale = 2.0;
    break;
  case 'Temple_roman':
    modelscale = 0.75;
    break;
  case 'Temple_roman2':
    modelscale = 3.0;
    break;
  case 'Temple_babylonian':
    modelscale = 2.0;
    break;
  case 'Bank':
    modelscale = 1.35;
    break;
  case 'SETIProgram':
    modelscale = 1.35;
    break;
  case 'Palace':
    modelscale = 2.4;
    break;
  case 'PowerPlant':
    modelscale = 2.4;
    break;
  case 'Oracle':
    modelscale = 1.3;
    break;
  case 'Factory':
    modelscale = 2.2;
    break;
  case 'Marketplace':
    modelscale = 2.0;
    break;
  case 'University':
    modelscale = 1.5;
    break;
  case 'Aqueduct':
    modelscale = 0.25;
    break;

  default:
    if (filename.indexOf("Barracks") >= 0) {
      modelscale = 0.65;
    }
    else if (filename == "Granary" || filename == "Colosseum") {
      modelscale = 1.35;
    }
    else if (filename == "Cathedral") {
      modelscale = 1.5;
    }
    else if (filename == "Courthouse") {
      modelscale = 1.05;
    }
    else if (filename == "Colossus") {
      modelscale = 8.8;
    }
    break;
  }

    model.scale.x = model.scale.y = model.scale.z = modelscale;
    webgl_models[filename] = model;

    load_count++;
    if (load_count == total_model_count) webgl_preload_complete();

    /* Update view of tiles where model now has been downloaded. */
    for (var ptile_index in tiles_of_unloaded_models_map) {
      var ptile = tiles[ptile_index];
      if (ptile == null) continue;
      var model_filename = tiles_of_unloaded_models_map[ptile_index];
      if (filename == model_filename) {
        update_unit_position(ptile);
        update_city_position(ptile);
        update_tile_extras(ptile);
        delete tiles_of_unloaded_models_map[ptile_index];
        delete models_loading_map[model_filename];
      }
    }

   });
}

/****************************************************************************
 Returns a single 3D model mesh object.
****************************************************************************/
function webgl_get_model(filename, ptile)
{
  if (webgl_models[filename] != null) {
    return webgl_models[filename].clone();
  } else {
    // Download model and redraw the tile when loaded.
    tiles_of_unloaded_models_map[ptile['index']] = filename;

    if (models_loading_map[filename] == null) {
      models_loading_map[filename] = filename;
      load_model(filename);
    }

    return null;
  }
}