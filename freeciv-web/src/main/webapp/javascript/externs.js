/**
 * @fileoverview Closure Compiler externs for external libraries.
 * This file declares external symbols that should not be renamed
 * by Closure Compiler's ADVANCED_OPTIMIZATIONS.
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
// Stats.js
// =============================================================================

/**
 * @constructor
 */
function Stats() {}

/** @type {Element} */
Stats.prototype.dom;

/** @type {Element} */
Stats.prototype.domElement;

/** @return {undefined} */
Stats.prototype.begin = function() {};

/** @return {number} */
Stats.prototype.end = function() {};

/** @return {undefined} */
Stats.prototype.update = function() {};

/**
 * @param {number} mode
 * @return {undefined}
 */
Stats.prototype.showPanel = function(mode) {};

/**
 * @param {number} mode
 * @return {undefined}
 */
Stats.prototype.setMode = function(mode) {};

/**
 * @param {Object} panel
 * @return {Object}
 */
Stats.prototype.addPanel = function(panel) {};

/**
 * @constructor
 * @param {string} name
 * @param {string} fg
 * @param {string} bg
 */
Stats.Panel = function(name, fg, bg) {};

/** @type {Element} */
Stats.Panel.prototype.dom;

/**
 * @param {number} value
 * @param {number} maxValue
 */
Stats.Panel.prototype.update = function(value, maxValue) {};

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
// EventAggregator (internal library)
// =============================================================================

/**
 * @constructor
 * @param {function(?)} handler
 * @param {number=} timeout
 * @param {number=} dataPolicy
 * @param {number=} latency
 * @param {number=} maxDelays
 * @param {number=} delayTimeout
 */
function EventAggregator(handler, timeout, dataPolicy, latency, maxDelays, delayTimeout) {}

/** @type {number} */
EventAggregator.DP_NONE;

/** @type {number} */
EventAggregator.DP_FIRST;

/** @type {number} */
EventAggregator.DP_LAST;

/** @type {number} */
EventAggregator.DP_COUNT;

/** @type {number} */
EventAggregator.DP_ALL;

/** @return {undefined} */
EventAggregator.prototype.fireNow = function() {};

/**
 * @param {*=} data
 * @return {undefined}
 */
EventAggregator.prototype.update = function(data) {};

/** @return {undefined} */
EventAggregator.prototype.cancel = function() {};

/** @return {undefined} */
EventAggregator.prototype.clear = function() {};

// =============================================================================
// Timer (internal library)
// =============================================================================

/**
 * @constructor
 * @param {number=} pauseTime
 */
function Timer(pauseTime) {}

/** @return {undefined} */
Timer.prototype.start = function() {};

/** @return {undefined} */
Timer.prototype.stop = function() {};

/** @return {boolean} */
Timer.prototype.isStarted = function() {};

/** @return {number} */
Timer.prototype.getPauseTime = function() {};

/**
 * @param {number} pauseTime
 * @return {undefined}
 */
Timer.prototype.setPauseTime = function(pauseTime) {};

/** @type {function()} */
Timer.prototype.ontimer;

// =============================================================================
// Slider (internal library)
// =============================================================================

/** @type {boolean} */
var Slider_isSupported;

/**
 * @constructor
 * @param {Element} element
 * @param {Element} input
 * @param {string=} orientation
 */
function Slider(element, input, orientation) {}

/** @type {boolean} */
Slider.isSupported;

/** @type {Object} */
Slider.eventHandlers;

/** @type {Object} */
Slider._currentInstance;

/** @type {Object} */
Slider._sliderDragData;

/**
 * @param {number} value
 * @return {undefined}
 */
Slider.prototype.setValue = function(value) {};

/** @return {number} */
Slider.prototype.getValue = function() {};

/**
 * @param {number} value
 * @return {undefined}
 */
Slider.prototype.setMinimum = function(value) {};

/** @return {number} */
Slider.prototype.getMinimum = function() {};

/**
 * @param {number} value
 * @return {undefined}
 */
Slider.prototype.setMaximum = function(value) {};

/** @return {number} */
Slider.prototype.getMaximum = function() {};

/**
 * @param {number} value
 * @return {undefined}
 */
Slider.prototype.setUnitIncrement = function(value) {};

/** @return {number} */
Slider.prototype.getUnitIncrement = function() {};

/**
 * @param {number} value
 * @return {undefined}
 */
Slider.prototype.setBlockIncrement = function(value) {};

/** @return {number} */
Slider.prototype.getBlockIncrement = function() {};

/** @return {string} */
Slider.prototype.getOrientation = function() {};

/**
 * @param {string} orientation
 * @return {undefined}
 */
Slider.prototype.setOrientation = function(orientation) {};

/** @return {undefined} */
Slider.prototype.recalculate = function() {};

/** @return {undefined} */
Slider.prototype.ontimer = function() {};

/** @type {function()} */
Slider.prototype.onchange;

// =============================================================================
// Range (internal library)
// =============================================================================

/**
 * @constructor
 */
function Range() {}

/**
 * @param {number} value
 * @return {undefined}
 */
Range.prototype.setValue = function(value) {};

/** @return {number} */
Range.prototype.getValue = function() {};

/**
 * @param {number} extent
 * @return {undefined}
 */
Range.prototype.setExtent = function(extent) {};

/** @return {number} */
Range.prototype.getExtent = function() {};

/**
 * @param {number} minimum
 * @return {undefined}
 */
Range.prototype.setMinimum = function(minimum) {};

/** @return {number} */
Range.prototype.getMinimum = function() {};

/**
 * @param {number} maximum
 * @return {undefined}
 */
Range.prototype.setMaximum = function(maximum) {};

/** @return {number} */
Range.prototype.getMaximum = function() {};

/** @type {function()} */
Range.prototype.onchange;

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
// WebSocket API
// =============================================================================

/**
 * @constructor
 * @param {string} url
 * @param {(string|Array<string>)=} protocols
 */
function WebSocket(url, protocols) {}

/** @type {number} */
WebSocket.prototype.readyState;

/** @type {string} */
WebSocket.prototype.binaryType;

/**
 * @param {string|ArrayBuffer|Blob} data
 */
WebSocket.prototype.send = function(data) {};

/** @return {undefined} */
WebSocket.prototype.close = function() {};

/** @type {function(Event)} */
WebSocket.prototype.onopen;

/** @type {function(Event)} */
WebSocket.prototype.onclose;

/** @type {function(Event)} */
WebSocket.prototype.onerror;

/** @type {function(MessageEvent)} */
WebSocket.prototype.onmessage;

/** @type {number} */
WebSocket.CONNECTING;

/** @type {number} */
WebSocket.OPEN;

/** @type {number} */
WebSocket.CLOSING;

/** @type {number} */
WebSocket.CLOSED;

// =============================================================================
// Web APIs
// =============================================================================

/** @type {Object} */
var navigator;

/** @type {Object} */
navigator.gpu;

/** @type {string} */
navigator.userAgent;

/** @type {string} */
navigator.language;

/** @type {Array<string>} */
navigator.languages;

/** @type {Object} */
navigator.mediaDevices;

/** @type {Object} */
var performance;

/**
 * @return {number}
 */
performance.now = function() {};

/** @type {Object} */
var console;

/**
 * @param {...*} args
 */
console.log = function(args) {};

/**
 * @param {...*} args
 */
console.warn = function(args) {};

/**
 * @param {...*} args
 */
console.error = function(args) {};

/**
 * @param {...*} args
 */
console.info = function(args) {};

/**
 * @param {...*} args
 */
console.debug = function(args) {};

/** @type {Object} */
var localStorage;

/**
 * @param {string} key
 * @return {string|null}
 */
localStorage.getItem = function(key) {};

/**
 * @param {string} key
 * @param {string} value
 */
localStorage.setItem = function(key, value) {};

/**
 * @param {string} key
 */
localStorage.removeItem = function(key) {};

/** @return {undefined} */
localStorage.clear = function() {};

/** @type {number} */
localStorage.length;

/**
 * @param {number} index
 * @return {string|null}
 */
localStorage.key = function(index) {};

// =============================================================================
// Additional Browser APIs
// =============================================================================

/**
 * @param {string} message
 * @return {boolean}
 */
function confirm(message) {}

/**
 * @param {string} message
 * @param {string=} defaultValue
 * @return {string|null}
 */
function prompt(message, defaultValue) {}

/**
 * @param {string} message
 */
function alert(message) {}

/**
 * @param {function()} callback
 * @return {number}
 */
function requestAnimationFrame(callback) {}

/**
 * @param {number} handle
 */
function cancelAnimationFrame(handle) {}

// =============================================================================
// JSON
// =============================================================================

/** @type {Object} */
var JSON;

/**
 * @param {string} text
 * @param {function(string, *)=} reviver
 * @return {*}
 */
JSON.parse = function(text, reviver) {};

/**
 * @param {*} value
 * @param {(function(string, *)|Array<string>)=} replacer
 * @param {(number|string)=} space
 * @return {string}
 */
JSON.stringify = function(value, replacer, space) {};
