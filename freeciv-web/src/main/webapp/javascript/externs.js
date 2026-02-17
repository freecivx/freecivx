/**
 * @fileoverview Closure Compiler externs for external libraries.
 * This file declares external symbols that should not be renamed
 * by Closure Compiler's ADVANCED_OPTIMIZATIONS.
 * 
 * Note: Browser built-ins (WebSocket, navigator, console, etc.) and
 * internal libraries (EventAggregator, Timer, Slider, Range, Stats)
 * are not included here as they are either provided by Closure's
 * built-in externs or defined in the source code.
 * 
 * @externs
 */

// =============================================================================
// jQuery and jQuery UI
// =============================================================================

/** @type {function(*=): !jQuery} */
var $;

/** @constructor */
function jQuery() {}

/**
 * @param {(string|Object)=} options
 * @return {!jQuery}
 */
jQuery.prototype.dialog = function(options) {};

/**
 * @param {(string|Object)=} options
 * @return {!jQuery}
 */
jQuery.prototype.dialogExtend = function(options) {};

/**
 * @param {Object=} options
 * @return {!jQuery}
 */
jQuery.prototype.tablesorter = function(options) {};

/**
 * @param {(string|Object)=} options
 * @return {!jQuery}
 */
jQuery.prototype.mCustomScrollbar = function(options) {};

/**
 * @param {Object} options
 * @return {!jQuery}
 */
jQuery.prototype.contextMenu = function(options) {};

/** @return {!jQuery} */
jQuery.prototype.show = function() {};

/** @return {!jQuery} */
jQuery.prototype.hide = function() {};

/**
 * @param {(number|string|function())=} duration
 * @param {(string|function())=} easing
 * @param {function()=} callback
 * @return {!jQuery}
 */
jQuery.prototype.fadeIn = function(duration, easing, callback) {};

/**
 * @param {(number|string|function())=} duration
 * @param {(string|function())=} easing
 * @param {function()=} callback
 * @return {!jQuery}
 */
jQuery.prototype.fadeOut = function(duration, easing, callback) {};

/**
 * @param {string} className
 * @return {!jQuery}
 */
jQuery.prototype.addClass = function(className) {};

/**
 * @param {string} className
 * @return {!jQuery}
 */
jQuery.prototype.removeClass = function(className) {};

/**
 * @param {string} className
 * @return {!jQuery}
 */
jQuery.prototype.toggleClass = function(className) {};

/**
 * @param {string=} value
 * @return {!jQuery|string}
 */
jQuery.prototype.html = function(value) {};

/**
 * @param {string=} value
 * @return {!jQuery|string}
 */
jQuery.prototype.text = function(value) {};

/**
 * @param {string=} value
 * @return {!jQuery|string}
 */
jQuery.prototype.val = function(value) {};

/**
 * @param {string} name
 * @param {string=} value
 * @return {!jQuery|string}
 */
jQuery.prototype.attr = function(name, value) {};

/**
 * @param {string} name
 * @param {*=} value
 * @return {!jQuery|*}
 */
jQuery.prototype.css = function(name, value) {};

/**
 * @param {string|Object} content
 * @return {!jQuery}
 */
jQuery.prototype.append = function(content) {};

/**
 * @param {string|Object} content
 * @return {!jQuery}
 */
jQuery.prototype.prepend = function(content) {};

/** @return {!jQuery} */
jQuery.prototype.remove = function() {};

/** @return {!jQuery} */
jQuery.prototype.empty = function() {};

/**
 * @param {string} selector
 * @return {!jQuery}
 */
jQuery.prototype.find = function(selector) {};

/**
 * @param {string} events
 * @param {function(Object)} handler
 * @return {!jQuery}
 */
jQuery.prototype.on = function(events, handler) {};

/**
 * @param {string=} events
 * @param {function(Object)=} handler
 * @return {!jQuery}
 */
jQuery.prototype.off = function(events, handler) {};

/**
 * @param {function(Object)} handler
 * @return {!jQuery}
 */
jQuery.prototype.click = function(handler) {};

/**
 * @param {function(Object)=} handler
 * @return {!jQuery}
 */
jQuery.prototype.keydown = function(handler) {};

/**
 * @param {function(Object)=} handler
 * @return {!jQuery}
 */
jQuery.prototype.keypress = function(handler) {};

/**
 * @param {function(Object)=} handler
 * @return {!jQuery}
 */
jQuery.prototype.keyup = function(handler) {};

/** @return {!jQuery} */
jQuery.prototype.focus = function() {};

/** @return {!jQuery} */
jQuery.prototype.blur = function() {};

/**
 * @param {string=} value
 * @return {!jQuery|number}
 */
jQuery.prototype.width = function(value) {};

/**
 * @param {string=} value
 * @return {!jQuery|number}
 */
jQuery.prototype.height = function(value) {};

/**
 * @param {number=} value
 * @return {!jQuery|number}
 */
jQuery.prototype.scrollTop = function(value) {};

/**
 * @param {string} prop
 * @param {*=} value
 * @return {!jQuery|*}
 */
jQuery.prototype.prop = function(prop, value) {};

/**
 * @param {string} key
 * @param {*=} value
 * @return {!jQuery|*}
 */
jQuery.prototype.data = function(key, value) {};

/**
 * @param {number=} index
 * @return {Element|Array<Element>}
 */
jQuery.prototype.get = function(index) {};

/** @type {number} */
jQuery.prototype.length;

/** @return {!jQuery} */
jQuery.prototype.parent = function() {};

/** @return {!jQuery} */
jQuery.prototype.children = function() {};

/**
 * @param {string} selector
 * @return {!jQuery}
 */
jQuery.prototype.closest = function(selector) {};

/**
 * @param {string} selector
 * @return {boolean}
 */
jQuery.prototype.is = function(selector) {};

/**
 * @param {function(number, Element)} handler
 * @return {!jQuery}
 */
jQuery.prototype.each = function(handler) {};

/** @return {Object} */
jQuery.prototype.offset = function() {};

/** @return {Object} */
jQuery.prototype.position = function() {};

/** 
 * @param {Object} target
 * @param {...Object} sources
 * @return {Object}
 */
$.extend = function(target, sources) {};

/** @type {Object} */
$.fn;

/** @return {Object} */
$.getUrlVars = function() {};

/**
 * @param {string} name
 * @return {string|undefined}
 */
$.getUrlVar = function(name) {};

/**
 * @param {Object} options
 */
$.blockUI = function(options) {};

/** @return {undefined} */
$.unblockUI = function() {};

/** @type {Object} */
$.blockUI.defaults;

/**
 * @param {string} url
 * @param {Object=} settings
 * @return {Object}
 */
$.ajax = function(url, settings) {};

/**
 * @param {string} url
 * @param {Object|function(Object)=} data
 * @param {function(Object)=} callback
 * @return {Object}
 */
$.get = function(url, data, callback) {};

/**
 * @param {string} url
 * @param {Object|function(Object)=} data
 * @param {function(Object)=} callback
 * @return {Object}
 */
$.post = function(url, data, callback) {};

/**
 * @param {string} url
 * @param {function(Object)} callback
 * @return {Object}
 */
$.getJSON = function(url, callback) {};

/**
 * @param {*} obj
 * @return {boolean}
 */
$.isEmptyObject = function(obj) {};

/**
 * @param {*} obj
 * @return {boolean}
 */
$.isArray = function(obj) {};

// =============================================================================
// jQuery UI
// =============================================================================

/** @type {Object} */
$.ui;

/** @type {Object} */
$.ui.dialog;

/** @type {Object} */
$.ui.dialog.prototype;

/** @type {Object} */
$.ui.dialog.prototype.options;

// =============================================================================
// SweetAlert
// =============================================================================

/**
 * @param {string|Object} arg1
 * @param {(string|function(boolean))=} arg2
 * @param {string=} arg3
 * @return {undefined}
 */
function swal(arg1, arg2, arg3) {}

/**
 * @param {string|Object} arg1
 * @param {(string|function(boolean))=} arg2
 * @param {string=} arg3
 * @return {undefined}
 */
function sweetAlert(arg1, arg2, arg3) {}

/** @return {undefined} */
swal.close = function() {};

/**
 * @param {string} message
 * @return {undefined}
 */
swal.showInputError = function(message) {};

/** @return {undefined} */
swal.resetInputError = function() {};

/** @return {undefined} */
swal.enableButtons = function() {};

/** @return {undefined} */
swal.disableButtons = function() {};

// =============================================================================
// simpleStorage
// =============================================================================

/** @type {Object} */
var simpleStorage;

/**
 * @param {string} key
 * @param {*} value
 * @param {Object=} options
 * @return {boolean}
 */
simpleStorage.set = function(key, value, options) {};

/**
 * @param {string} key
 * @return {*}
 */
simpleStorage.get = function(key) {};

/**
 * @param {string} key
 * @return {boolean}
 */
simpleStorage.hasKey = function(key) {};

/**
 * @param {string} key
 * @return {boolean}
 */
simpleStorage.deleteKey = function(key) {};

/** @return {boolean} */
simpleStorage.canUse = function() {};

/** @return {boolean} */
simpleStorage.flush = function() {};

/** @return {Array<string>} */
simpleStorage.index = function() {};

// =============================================================================
// BigScreen (Fullscreen API)
// =============================================================================

/** @type {Object} */
var BigScreen;

/**
 * @param {Element} element
 * @param {function()=} onEnter
 * @param {function()=} onExit
 * @param {function()=} onError
 */
BigScreen.request = function(element, onEnter, onExit, onError) {};

/** @return {undefined} */
BigScreen.exit = function() {};

/**
 * @param {Element=} element
 */
BigScreen.toggle = function(element) {};

/** @type {Element|null} */
BigScreen.element;

/** @type {boolean} */
BigScreen.enabled;

/**
 * @param {Element=} element
 * @return {boolean|string}
 */
BigScreen.videoEnabled = function(element) {};

/** @type {function(Element)} */
BigScreen.onenter;

/** @type {function()} */
BigScreen.onexit;

/** @type {function(Element)} */
BigScreen.onchange;

/** @type {function(Element, string)} */
BigScreen.onerror;

// =============================================================================
// seedrandom (Math.seedrandom)
// =============================================================================

/**
 * @param {string=} seed
 * @param {Object=} options
 * @return {function(): number}
 */
Math.seedrandom = function(seed, options) {};

// =============================================================================
// jsSHA
// =============================================================================

/**
 * @constructor
 * @param {string} variant
 * @param {string} inputFormat
 * @param {Object=} options
 */
function jsSHA(variant, inputFormat, options) {}

/**
 * @param {string} data
 * @return {undefined}
 */
jsSHA.prototype.update = function(data) {};

/**
 * @param {string} format
 * @param {Object=} options
 * @return {string}
 */
jsSHA.prototype.getHash = function(format, options) {};

// =============================================================================
// Platform.js
// =============================================================================

/** @type {Object} */
var platform;

/** @type {string} */
platform.name;

/** @type {string} */
platform.version;

/** @type {Object} */
platform.os;

/** @type {string} */
platform.os.family;

/** @type {string} */
platform.os.version;

/** @type {string} */
platform.description;

/** @type {string} */
platform.layout;

/** @type {string} */
platform.manufacturer;

/** @type {string} */
platform.product;

// =============================================================================
// THREE.js (Three.js library)
// =============================================================================

/** @type {Object} */
var THREE;

/** @constructor */
THREE.Scene = function() {};

/** @constructor */
THREE.PerspectiveCamera = function() {};

/** @constructor */
THREE.WebGLRenderer = function() {};

/** @constructor */
THREE.Vector2 = function() {};

/** @constructor */
THREE.Vector3 = function() {};

/** @constructor */
THREE.Vector4 = function() {};

/** @constructor */
THREE.Matrix3 = function() {};

/** @constructor */
THREE.Matrix4 = function() {};

/** @constructor */
THREE.Quaternion = function() {};

/** @constructor */
THREE.Euler = function() {};

/** @constructor */
THREE.Color = function() {};

/** @constructor */
THREE.Mesh = function() {};

/** @constructor */
THREE.Object3D = function() {};

/** @constructor */
THREE.Group = function() {};

/** @constructor */
THREE.Geometry = function() {};

/** @constructor */
THREE.BufferGeometry = function() {};

/** @constructor */
THREE.Material = function() {};

/** @constructor */
THREE.MeshBasicMaterial = function() {};

/** @constructor */
THREE.MeshStandardMaterial = function() {};

/** @constructor */
THREE.MeshPhongMaterial = function() {};

/** @constructor */
THREE.ShaderMaterial = function() {};

/** @constructor */
THREE.Texture = function() {};

/** @constructor */
THREE.TextureLoader = function() {};

/** @constructor */
THREE.Light = function() {};

/** @constructor */
THREE.AmbientLight = function() {};

/** @constructor */
THREE.DirectionalLight = function() {};

/** @constructor */
THREE.PointLight = function() {};

/** @constructor */
THREE.SpotLight = function() {};

/** @constructor */
THREE.Raycaster = function() {};

/** @constructor */
THREE.Box3 = function() {};

/** @constructor */
THREE.Sphere = function() {};

/** @constructor */
THREE.Plane = function() {};

/** @constructor */
THREE.Clock = function() {};

/** @constructor */
THREE.AnimationMixer = function() {};

/** @constructor */
THREE.InstancedMesh = function() {};

/** @constructor */
THREE.InstancedBufferGeometry = function() {};

/** @constructor */
THREE.InstancedBufferAttribute = function() {};

/** @constructor */
THREE.BufferAttribute = function() {};

/** @constructor */
THREE.Float32BufferAttribute = function() {};

/** @constructor */
THREE.Int32BufferAttribute = function() {};

/** @constructor */
THREE.PlaneGeometry = function() {};

/** @constructor */
THREE.BoxGeometry = function() {};

/** @constructor */
THREE.SphereGeometry = function() {};

/** @constructor */
THREE.CylinderGeometry = function() {};

/** @type {number} */
THREE.FrontSide;

/** @type {number} */
THREE.BackSide;

/** @type {number} */
THREE.DoubleSide;

/** @type {number} */
THREE.NearestFilter;

/** @type {number} */
THREE.LinearFilter;

/** @type {number} */
THREE.LinearMipmapLinearFilter;

/** @type {number} */
THREE.RepeatWrapping;

/** @type {number} */
THREE.ClampToEdgeWrapping;

/** @type {number} */
THREE.MirroredRepeatWrapping;

/** @type {number} */
THREE.sRGBEncoding;

/** @type {number} */
THREE.LinearEncoding;

/** @type {number} */
THREE.RGBAFormat;

/** @type {number} */
THREE.RGBFormat;

/** @type {number} */
THREE.UnsignedByteType;

/** @type {number} */
THREE.FloatType;

/** @type {number} */
THREE.AdditiveBlending;

/** @type {number} */
THREE.SubtractiveBlending;

/** @type {number} */
THREE.MultiplyBlending;

/** @type {number} */
THREE.NormalBlending;

/** @type {string} */
THREE.REVISION;

// =============================================================================
// Three.js Loaders and Controls
// =============================================================================

/** @constructor */
function GLTFLoader() {}

/**
 * @param {Object} dracoLoader
 */
GLTFLoader.prototype.setDRACOLoader = function(dracoLoader) {};

/**
 * @param {string} url
 * @param {function(Object)} onLoad
 * @param {function(Object)=} onProgress
 * @param {function(Error)=} onError
 */
GLTFLoader.prototype.load = function(url, onLoad, onProgress, onError) {};

/** @constructor */
function DRACOLoader() {}

/**
 * @param {string} path
 */
DRACOLoader.prototype.setDecoderPath = function(path) {};

/** @constructor */
function OrbitControls(camera, element) {}

/** @type {boolean} */
OrbitControls.prototype.enableDamping;

/** @type {number} */
OrbitControls.prototype.dampingFactor;

/** @type {boolean} */
OrbitControls.prototype.enablePan;

/** @type {boolean} */
OrbitControls.prototype.enableZoom;

/** @return {undefined} */
OrbitControls.prototype.update = function() {};

// =============================================================================
// Morris.js (Charts)
// =============================================================================

/** @type {Object} */
var Morris;

/**
 * @param {Object} options
 */
Morris.Line = function(options) {};

/**
 * @param {Object} options
 */
Morris.Area = function(options) {};

/**
 * @param {Object} options
 */
Morris.Bar = function(options) {};

// =============================================================================
// modern-screenshot library
// =============================================================================

/** @type {Object} */
var modernScreenshot;

/**
 * @param {Element} element
 * @param {Object=} options
 * @return {Promise}
 */
modernScreenshot.domToBlob = function(element, options) {};

/**
 * @param {Element} element
 * @param {Object=} options
 * @return {Promise}
 */
modernScreenshot.domToPng = function(element, options) {};

// =============================================================================
// Globalize (jQuery UI internationalization)
// =============================================================================

/** @type {Object} */
var Globalize;

// =============================================================================
// localStorage (Browser API)
// =============================================================================

/** @type {Storage} */
var localStorage;

// =============================================================================
// TrackJS (Error Tracking)
// =============================================================================

/** @type {Object} */
var trackJs;

/**
 * @param {Error} error
 */
trackJs.track = function(error) {};

// =============================================================================
// DocumentTouch (Touch detection - deprecated API)
// =============================================================================

/** @constructor */
function DocumentTouch() {}

// =============================================================================
// Node.js style require (CommonJS - used by some libs)
// =============================================================================

/**
 * @param {string} module
 * @return {*}
 */
function require(module) {}

// =============================================================================
// frameElement (Browser API)
// =============================================================================

/** @type {Element|null} */
var frameElement;

// =============================================================================
// Runtime-defined game constants (populated by ruleset.js)
// =============================================================================

/** @type {number} */
var EXTRA_ROAD;

/** @type {number} */
var EXTRA_RAIL;

/** @type {number} */
var EXTRA_RIVER;

/** @type {number} */
var EXTRA_MINE;

/** @type {number} */
var EXTRA_IRRIGATION;

/** @type {number} */
var EXTRA_OIL_WELL;

/** @type {number} */
var EXTRA_HUT;

/** @type {number} */
var EXTRA_RUINS;

/** @type {number} */
var EXTRA_FORTRESS;

/** @type {number} */
var EXTRA_AIRBASE;

/** @type {number} */
var EXTRA_FALLOUT;

/** @type {number} */
var EXTRA_POLLUTION;

/** @type {number} */
var EXTRA_BUOY;

/** @type {number} */
var EXTRA_FARMLAND;

// =============================================================================
// Runtime-defined game variables (various sources)
// =============================================================================

/** @type {number} */
var touch_start_x;

/** @type {number} */
var touch_start_y;

/** @type {boolean} */
var goto_preview_active;

/** @type {*} */
var road_positions;

/** @type {*} */
var rail_positions;

/** @type {*} */
var texture;

/** @type {*} */
var pos;

/** @type {number} */
var ts;

/** @type {*} */
var closed_dialog_already;

/** @type {*} */
var timeoutTimerId;

/** @type {*} */
var statusTimerId;

/** @type {*} */
var loaded_game_type;

/** @type {boolean} */
var hotseat_enabled;

/** @type {*} */
var research_goal_text;

/** @type {*} */
var openai_setting;

/** @type {*} */
var NULL;

/** @type {number} */
var VUT_BASEFLAG;

// =============================================================================
// 2D Canvas Tileset variables
// =============================================================================

/** @type {function(...)} */
var fill_terrain_sprite_array;

/** @type {number} */
var city_flag_offset_x;

/** @type {number} */
var city_flag_offset_y;

/** @type {number} */
var citybar_offset_x;

/** @type {number} */
var citybar_offset_y;

/** @type {number} */
var tilelabel_offset_x;

/** @type {number} */
var tilelabel_offset_y;

// =============================================================================
// Third-party library internals
// =============================================================================

/** @type {*} */
var dx;

/** @type {string} */
var logStr;
