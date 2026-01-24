// Mock webgl_get_model with null check wrapper
var original_webgl_get_model = null;
window.addEventListener('load', function() {
  if (typeof webgl_get_model !== 'undefined') {
    original_webgl_get_model = webgl_get_model;
  }
});

// Safely wrap model loading to prevent null reference errors
function safe_webgl_get_model(modelname, ptile) {
  if (typeof webgl_get_model === 'function') {
    try {
      var model = webgl_get_model(modelname, ptile);
      if (model === null || model === undefined) {
        console.warn("Model not found or not loaded yet:", modelname);
        return null;
      }
      return model;
    } catch (e) {
      console.warn("Error loading model:", modelname, e);
      return null;
    }
  }
  return null;
}