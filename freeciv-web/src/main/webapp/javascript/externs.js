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
 * @param {(string|Object)=} optionsOrMethod
 * @param {...*} args
 * @return {!jQuery}
 */
jQuery.prototype.dialog = function(optionsOrMethod, args) {};

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
 * @param {(string|Object)=} optionsOrMethod
 * @param {...*} args
 * @return {!jQuery}
 */
jQuery.prototype.mCustomScrollbar = function(optionsOrMethod, args) {};

/**
 * @param {(Object|string)=} options
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
 * @param {*=} value
 * @return {!jQuery|string}
 */
jQuery.prototype.html = function(value) {};

/**
 * @param {string=} value
 * @return {!jQuery|string}
 */
jQuery.prototype.text = function(value) {};

/**
 * @param {*=} value
 * @return {!jQuery|string}
 */
jQuery.prototype.val = function(value) {};

/**
 * @param {string|Object} name
 * @param {*=} value
 * @return {!jQuery|string}
 */
jQuery.prototype.attr = function(name, value) {};

/**
 * @param {string|Object} name
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
 * @param {string|function(Object)=} eventsOrHandler
 * @param {(string|function(Object)|Object)=} selectorOrHandler
 * @param {function(Object)=} handler
 * @return {!jQuery}
 */
jQuery.prototype.on = function(eventsOrHandler, selectorOrHandler, handler) {};

/**
 * @param {string=} events
 * @param {function(Object)=} handler
 * @return {!jQuery}
 */
jQuery.prototype.off = function(events, handler) {};

/**
 * @param {function(Object)=} handler
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

/**
 * @param {function(Object)=} handler
 * @return {!jQuery}
 */
jQuery.prototype.focus = function(handler) {};

/**
 * @param {function(Object)=} handler
 * @return {!jQuery}
 */
jQuery.prototype.blur = function(handler) {};

/**
 * @param {*=} value
 * @return {!jQuery|number}
 */
jQuery.prototype.width = function(value) {};

/**
 * @param {*=} value
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
 * @param {string|function(number, Element): boolean} selector
 * @return {!jQuery}
 */
jQuery.prototype.filter = function(selector) {};

/** @return {!jQuery} */
jQuery.prototype.first = function() {};

/** @return {!jQuery} */
jQuery.prototype.next = function() {};

/** @return {!jQuery} */
jQuery.prototype.prev = function() {};

/**
 * @param {number} index
 * @return {!jQuery}
 */
jQuery.prototype.eq = function(index) {};

/**
 * @param {string|Element|jQuery} selector
 * @return {!jQuery}
 */
jQuery.prototype.not = function(selector) {};

/** @return {!jQuery} */
jQuery.prototype.siblings = function() {};

/**
 * @param {string} name
 * @return {!jQuery}
 */
jQuery.prototype.removeAttr = function(name) {};

/**
 * @param {boolean=} withMargin
 * @return {number}
 */
jQuery.prototype.outerHeight = function(withMargin) {};

/**
 * @param {string|function(Object)} eventsOrHandler
 * @param {function(Object)=} handler
 * @return {!jQuery}
 */
jQuery.prototype.bind = function(eventsOrHandler, handler) {};

/**
 * @param {string=} events
 * @param {function(Object)=} handler
 * @return {!jQuery}
 */
jQuery.prototype.unbind = function(events, handler) {};

/**
 * @param {function(Object)} handler
 * @return {!jQuery}
 */
jQuery.prototype.mousedown = function(handler) {};

/**
 * @param {function(Object)} handler
 * @return {!jQuery}
 */
jQuery.prototype.mouseup = function(handler) {};

/**
 * @param {function(Object)} handler
 * @return {!jQuery}
 */
jQuery.prototype.mousemove = function(handler) {};

/**
 * @param {function(Object)} handler
 * @return {!jQuery}
 */
jQuery.prototype.resize = function(handler) {};

/**
 * @param {function(Object)} handler
 * @return {!jQuery}
 */
jQuery.prototype.change = function(handler) {};

/**
 * @param {function(Object)} handler
 * @return {!jQuery}
 */
jQuery.prototype.contextmenu = function(handler) {};

/**
 * @param {function()} handler
 * @return {!jQuery}
 */
jQuery.prototype.error = function(handler) {};

/**
 * @param {function()} handler
 * @return {!jQuery}
 */
jQuery.prototype.load = function(handler) {};

/**
 * @param {Object=} options
 * @return {!jQuery}
 */
jQuery.prototype.autocomplete = function(options) {};

/**
 * @param {Object=} options
 * @return {!jQuery}
 */
jQuery.prototype.selectable = function(options) {};

/**
 * @param {Object=} options
 * @return {!jQuery}
 */
jQuery.prototype.tooltip = function(options) {};

/**
 * @param {boolean=} withDataAndEvents
 * @return {!jQuery}
 */
jQuery.prototype.clone = function(withDataAndEvents) {};

/** @type {*} */
jQuery.prototype.style;

/**
 * @param {...*} var_args
 * @return {*}
 */
jQuery.prototype.extend = function(var_args) {};

/** 
 * @param {*} target
 * @param {...*} sources
 * @return {*}
 */
$.extend = function(target, sources) {};

/**
 * @param {...*} var_args
 * @return {*}
 */
jQuery.extend = function(var_args) {};

/** @type {Object} */
$.fn;

/** @type {Object} */
jQuery.fn;

/** @type {string} */
jQuery.jquery;

/** @type {Object} */
jQuery.event;

/**
 * @param {Element} elem
 * @param {string} types
 * @param {function(Object)} handler
 * @param {*=} data
 * @param {*=} selector
 */
jQuery.event.add = function(elem, types, handler, data, selector) {};

/**
 * @param {Element} elem
 * @param {string=} types
 * @param {function(Object)=} handler
 * @param {*=} selector
 * @param {boolean=} mappedTypes
 */
jQuery.event.remove = function(elem, types, handler, selector, mappedTypes) {};

/**
 * @param {Element} elem
 * @param {string} type
 * @return {*}
 */
jQuery._queueHooks = function(elem, type) {};

/**
 * @param {Element} elem
 * @param {string=} type
 */
jQuery.dequeue = function(elem, type) {};

/**
 * @param {*} obj
 * @param {function(*, *)} callback
 * @return {*}
 */
jQuery.each = function(obj, callback) {};

/**
 * @param {*} obj
 * @param {function(*, number): *} callback
 * @return {Array}
 */
jQuery.map = function(obj, callback) {};

/**
 * @param {*} arr
 * @param {function(*, number): boolean} callback
 * @param {boolean=} invert
 * @return {Array}
 */
jQuery.grep = function(arr, callback, invert) {};

/**
 * @param {*} elem
 * @param {*} arr
 * @param {number=} i
 * @return {number}
 */
jQuery.inArray = function(elem, arr, i) {};

/**
 * @param {*} arr
 * @return {Array}
 */
jQuery.makeArray = function(arr) {};

/**
 * @param {Array} first
 * @param {Array} second
 * @return {Array}
 */
jQuery.merge = function(first, second) {};

/**
 * @param {Element} elem
 * @return {boolean}
 */
jQuery.isXMLDoc = function(elem) {};

/**
 * @param {*} obj
 * @return {boolean}
 */
jQuery.isPlainObject = function(obj) {};

/**
 * @param {string} code
 * @return {*}
 */
jQuery.globalEval = function(code) {};

/**
 * @param {Element} context
 * @param {string} selector
 * @param {*=} results
 * @param {*=} seed
 * @return {Array}
 */
jQuery.find = function(context, selector, results, seed) {};

/**
 * @param {string} expr
 * @param {Array} elements
 * @param {boolean=} not
 * @return {Array}
 */
jQuery.filter = function(expr, elements, not) {};

/**
 * @param {Element} a
 * @param {Element} b
 * @return {boolean}
 */
jQuery.contains = function(a, b) {};

/**
 * @param {Element} elem
 * @param {string} name
 * @param {*=} value
 * @return {*}
 */
jQuery.attr = function(elem, name, value) {};

/** @type {Object} */
jQuery.attrHooks;

/** @type {Object} */
jQuery.propHooks;

/** @type {Object} */
jQuery.propFix;

/** @type {Object} */
jQuery.cssHooks;

/** @type {Object} */
jQuery.valHooks;

/**
 * @param {Object=} obj
 * @return {string}
 */
jQuery.param = function(obj) {};

/**
 * @param {string} data
 * @param {*=} context
 * @param {boolean=} keepScripts
 * @return {Array}
 */
jQuery.parseHTML = function(data, context, keepScripts) {};

/**
 * @param {string} html
 * @return {string}
 */
jQuery.htmlPrefilter = function(html) {};

/** @type {Object} */
jQuery.ajax;

/** @type {Object} */
jQuery.ajaxSettings;

/** @type {Object} */
jQuery.lastModified;

/** @type {Object} */
jQuery.etag;

/**
 * @param {Object} options
 */
jQuery.ajaxSetup = function(options) {};

/**
 * @param {string} dataType
 * @param {function(Object, Object)} callback
 */
jQuery.ajaxPrefilter = function(dataType, callback) {};

/**
 * @param {string} dataType
 * @param {function(Object, Object)} callback
 */
jQuery.ajaxTransport = function(dataType, callback) {};

/**
 * @param {*=} obj
 * @return {*}
 */
jQuery.Deferred = function(obj) {};

/** @type {number} */
jQuery.readyWait;

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

/**
 * @constructor
 */
THREE.Scene = function() {};

/**
 * @param {!THREE.Object3D} object
 */
THREE.Scene.prototype.add = function(object) {};

/**
 * @param {!THREE.Object3D} object
 */
THREE.Scene.prototype.remove = function(object) {};

/** @constructor */
THREE.Camera = function() {};

/**
 * @constructor
 * @param {number=} fov
 * @param {number=} aspect
 * @param {number=} near
 * @param {number=} far
 */
THREE.PerspectiveCamera = function(fov, aspect, near, far) {};

/**
 * @param {!THREE.Vector3} vector
 */
THREE.PerspectiveCamera.prototype.lookAt = function(vector) {};

THREE.PerspectiveCamera.prototype.updateProjectionMatrix = function() {};

THREE.PerspectiveCamera.prototype.updateMatrixWorld = function() {};

/** @constructor */
THREE.WebGLRenderer = function() {};

/** @constructor */
THREE.Vector2 = function() {};

/**
 * @constructor
 * @param {number=} x
 * @param {number=} y
 * @param {number=} z
 */
THREE.Vector3 = function(x, y, z) {};

/**
 * @return {!THREE.Vector3}
 */
THREE.Vector3.prototype.normalize = function() {};

/**
 * @return {!THREE.Vector3}
 */
THREE.Vector3.prototype.clone = function() {};

/**
 * @param {*} v
 * @return {!THREE.Vector3}
 */
THREE.Vector3.prototype.copy = function(v) {};

/**
 * @param {*} a
 * @param {*} b
 * @return {!THREE.Vector3}
 */
THREE.Vector3.prototype.subVectors = function(a, b) {};

/**
 * @param {*} v
 * @return {!THREE.Vector3}
 */
THREE.Vector3.prototype.add = function(v) {};

/**
 * @param {*} v
 * @return {!THREE.Vector3}
 */
THREE.Vector3.prototype.sub = function(v) {};

/**
 * @param {number} scalar
 * @return {!THREE.Vector3}
 */
THREE.Vector3.prototype.multiplyScalar = function(scalar) {};

/** @constructor */
THREE.Vector4 = function() {};

/** @constructor */
THREE.Matrix3 = function() {};

/** @constructor */
THREE.Matrix4 = function() {};

/**
 * @param {!THREE.Vector3} position
 * @param {!THREE.Quaternion} quaternion
 * @param {!THREE.Vector3} scale
 * @return {!THREE.Matrix4}
 */
THREE.Matrix4.prototype.compose = function(position, quaternion, scale) {};

/** @constructor */
THREE.Quaternion = function() {};

/**
 * @param {*} q
 * @return {!THREE.Quaternion}
 */
THREE.Quaternion.prototype.copy = function(q) {};

/**
 * @param {!THREE.Vector3} axis
 * @param {number} angle
 * @return {!THREE.Quaternion}
 */
THREE.Quaternion.prototype.setFromAxisAngle = function(axis, angle) {};

/**
 * @param {!THREE.Euler} euler
 * @return {!THREE.Quaternion}
 */
THREE.Quaternion.prototype.setFromEuler = function(euler) {};

/**
 * @param {*} vFrom
 * @param {*} vTo
 * @return {!THREE.Quaternion}
 */
THREE.Quaternion.prototype.setFromUnitVectors = function(vFrom, vTo) {};

/**
 * @constructor
 * @param {number=} x
 * @param {number=} y
 * @param {number=} z
 * @param {string=} order
 */
THREE.Euler = function(x, y, z, order) {};

/** @constructor */
THREE.Color = function() {};

/**
 * @constructor
 * @param {*=} geometry
 * @param {*=} material
 */
THREE.Mesh = function(geometry, material) {};

/** @type {*} */
THREE.Mesh.prototype.geometry;

/** @type {THREE.Euler} */
THREE.Mesh.prototype.rotation;

/** @type {THREE.Quaternion} */
THREE.Mesh.prototype.quaternion;

/** @type {*} */
THREE.Mesh.prototype.layers;

/**
 * @param {!THREE.Vector3} axis
 * @param {number} distance
 */
THREE.Mesh.prototype.translateOnAxis = function(axis, distance) {};

/** @constructor */
THREE.Object3D = function() {};

/** @type {!THREE.Vector3} */
THREE.Object3D.prototype.scale;

/**
 * @param {!THREE.Vector3} axis
 * @param {number} angle
 */
THREE.Object3D.prototype.rotateOnAxis = function(axis, angle) {};

/**
 * @param {!THREE.Vector3} axis
 * @param {number} distance
 */
THREE.Object3D.prototype.translateOnAxis = function(axis, distance) {};

/**
 * @param {function(!THREE.Object3D)} callback
 */
THREE.Object3D.prototype.traverse = function(callback) {};

THREE.Object3D.prototype.updateMatrix = function() {};

/** @constructor */
THREE.Group = function() {};

/**
 * @param {*} object
 */
THREE.Group.prototype.add = function(object) {};

/**
 * @param {!THREE.Object3D} object
 */
THREE.Group.prototype.remove = function(object) {};

/** @type {Array<!THREE.Object3D>} */
THREE.Group.prototype.children;

/** @constructor */
THREE.Geometry = function() {};

/** @constructor */
THREE.BufferGeometry = function() {};

/**
 * @param {string} name
 * @param {*} attribute
 */
THREE.BufferGeometry.prototype.setAttribute = function(name, attribute) {};

/**
 * @param {*} index
 */
THREE.BufferGeometry.prototype.setIndex = function(index) {};

THREE.BufferGeometry.prototype.computeVertexNormals = function() {};

/**
 * @param {number} angle
 */
THREE.BufferGeometry.prototype.rotateX = function(angle) {};

/**
 * @param {number} x
 * @param {number} y
 * @param {number} z
 */
THREE.BufferGeometry.prototype.translate = function(x, y, z) {};

/**
 * @param {Array<!THREE.Vector3>} points
 * @return {!THREE.BufferGeometry}
 */
THREE.BufferGeometry.prototype.setFromPoints = function(points) {};

/** @constructor */
THREE.Material = function() {};

/** @type {number} */
THREE.Material.prototype.metalness;

/** @type {number} */
THREE.Material.prototype.roughness;

/**
 * @constructor
 * @param {Object=} parameters
 */
THREE.MeshBasicMaterial = function(parameters) {};

/** @constructor */
THREE.MeshStandardMaterial = function() {};

/** @constructor */
THREE.MeshPhongMaterial = function() {};

/** @constructor */
THREE.ShaderMaterial = function() {};

/**
 * @constructor
 * @param {Object=} parameters
 */
THREE.LineBasicMaterial = function(parameters) {};

/**
 * @constructor
 * @param {Object=} parameters
 */
THREE.LineDashedMaterial = function(parameters) {};

/**
 * @constructor
 * @param {Object=} parameters
 */
THREE.SpriteMaterial = function(parameters) {};

/** @constructor */
THREE.ShadowMaterial = function() {};

/** @constructor */
THREE.MeshBasicNodeMaterial = function() {};

/** @type {*} */
THREE.MeshBasicNodeMaterial.prototype.uniforms;

/** @constructor */
THREE.MeshStandardNodeMaterial = function() {};

/** @type {*} */
THREE.MeshStandardNodeMaterial.prototype.color;

/** @type {*} */
THREE.MeshStandardNodeMaterial.prototype.emissive;

/**
 * @constructor
 * @param {*=} image
 */
THREE.Texture = function(image) {};

/** @constructor */
THREE.TextureLoader = function() {};

/**
 * @constructor
 * @param {*=} data
 * @param {number=} width
 * @param {number=} height
 * @param {number=} depth
 */
THREE.DataArrayTexture = function(data, width, height, depth) {};

/** @constructor */
THREE.Light = function() {};

/**
 * @constructor
 * @param {number=} color
 * @param {number=} intensity
 */
THREE.AmbientLight = function(color, intensity) {};

/**
 * @constructor
 * @param {number=} color
 * @param {number=} intensity
 */
THREE.DirectionalLight = function(color, intensity) {};

/** @type {*} */
THREE.DirectionalLight.prototype.shadow;

/**
 * @constructor
 * @param {number=} color
 * @param {number=} intensity
 * @param {number=} distance
 * @param {number=} decay
 */
THREE.PointLight = function(color, intensity, distance, decay) {};

/**
 * @constructor
 * @param {number=} color
 * @param {number=} intensity
 * @param {number=} distance
 * @param {number=} angle
 * @param {number=} penumbra
 * @param {number=} decay
 */
THREE.SpotLight = function(color, intensity, distance, angle, penumbra, decay) {};

/** @type {*} */
THREE.SpotLight.prototype.shadow;

/** @constructor */
THREE.Raycaster = function() {};

/**
 * @param {!THREE.Vector2} coords
 * @param {!THREE.Camera} camera
 */
THREE.Raycaster.prototype.setFromCamera = function(coords, camera) {};

/**
 * @param {!THREE.Object3D} object
 * @param {boolean=} recursive
 * @return {Array}
 */
THREE.Raycaster.prototype.intersectObject = function(object, recursive) {};

/** @type {*} */
THREE.Raycaster.prototype.layers;

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

/**
 * @constructor
 * @param {*=} geometry
 * @param {*=} material
 * @param {number=} count
 */
THREE.InstancedMesh = function(geometry, material, count) {};

/** @constructor */
THREE.InstancedBufferGeometry = function() {};

/** @constructor */
THREE.InstancedBufferAttribute = function() {};

/**
 * @constructor
 * @param {*=} array
 * @param {number=} itemSize
 */
THREE.BufferAttribute = function(array, itemSize) {};

/**
 * @constructor
 * @param {*=} array
 * @param {number=} itemSize
 */
THREE.Float32BufferAttribute = function(array, itemSize) {};

/** @constructor */
THREE.Int32BufferAttribute = function() {};

/**
 * @constructor
 * @param {number=} width
 * @param {number=} height
 * @param {number=} widthSegments
 * @param {number=} heightSegments
 */
THREE.PlaneGeometry = function(width, height, widthSegments, heightSegments) {};

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
