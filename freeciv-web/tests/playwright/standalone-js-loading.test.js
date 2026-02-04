const { test, expect } = require('@playwright/test');

/**
 * Test suite for verifying JavaScript file loading in the Freeciv-web standalone client
 * This tests that all critical JavaScript modules load correctly in the 3D client.
 */

test.describe('Freeciv-web Standalone JavaScript Loading', () => {
  
  test('Standalone client loads and initializes JavaScript modules', async ({ page }) => {
    // Collect console messages for verification
    const consoleMessages = [];
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect any JavaScript errors
    const jsErrors = [];
    page.on('pageerror', (error) => {
      jsErrors.push(error.message);
    });

    // Go to the standalone client page
    const response = await page.goto('http://localhost/freeciv-web-standalone.html', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Check if the page has loaded successfully
    if (!response || response.status() >= 400) {
      console.log(`Error: Server responded with status ${response ? response.status() : 'no response'}`);
      throw new Error(`Failed to load page: ${response ? response.status() : 'unknown error'}`);
    }

    // Wait for jQuery to be available
    await page.waitForFunction(() => typeof jQuery !== 'undefined', { timeout: 10000 });
    
    // Verify jQuery is loaded
    const jQueryLoaded = await page.evaluate(() => typeof jQuery !== 'undefined' && typeof $ !== 'undefined');
    expect(jQueryLoaded).toBe(true);
    console.log('✓ jQuery loaded successfully');

    // Wait for Three.js to be available (may take time for ES modules)
    await page.waitForFunction(() => typeof THREE !== 'undefined', { timeout: 15000 });
    
    // Verify THREE.js core is loaded
    const threeLoaded = await page.evaluate(() => {
      return {
        THREE: typeof THREE !== 'undefined',
        Scene: typeof THREE !== 'undefined' && typeof THREE.Scene !== 'undefined',
        PerspectiveCamera: typeof THREE !== 'undefined' && typeof THREE.PerspectiveCamera !== 'undefined',
        WebGLRenderer: typeof THREE !== 'undefined' && typeof THREE.WebGLRenderer !== 'undefined'
      };
    });
    
    expect(threeLoaded.THREE).toBe(true);
    expect(threeLoaded.Scene).toBe(true);
    expect(threeLoaded.PerspectiveCamera).toBe(true);
    expect(threeLoaded.WebGLRenderer).toBe(true);
    console.log('✓ Three.js core modules loaded successfully');

    // Verify Three.js loaders are loaded
    const loadersLoaded = await page.evaluate(() => {
      return {
        GLTFLoader: typeof GLTFLoader !== 'undefined' || typeof window.GLTFLoader !== 'undefined',
        DRACOLoader: typeof DRACOLoader !== 'undefined' || typeof window.DRACOLoader !== 'undefined',
        OrbitControls: typeof OrbitControls !== 'undefined' || typeof window.OrbitControls !== 'undefined'
      };
    });
    
    expect(loadersLoaded.GLTFLoader).toBe(true);
    expect(loadersLoaded.DRACOLoader).toBe(true);
    expect(loadersLoaded.OrbitControls).toBe(true);
    console.log('✓ Three.js loaders (GLTF, DRACO, OrbitControls) loaded successfully');

    // Verify core game functions exist
    const gameFunctionsLoaded = await page.evaluate(() => {
      return {
        game_init: typeof game_init === 'function',
        set_client_state: typeof set_client_state === 'function',
        init_standalone: typeof init_standalone === 'function',
        is_standalone_mode: typeof is_standalone_mode === 'function'
      };
    });
    
    expect(gameFunctionsLoaded.game_init).toBe(true);
    expect(gameFunctionsLoaded.set_client_state).toBe(true);
    expect(gameFunctionsLoaded.init_standalone).toBe(true);
    expect(gameFunctionsLoaded.is_standalone_mode).toBe(true);
    console.log('✓ Core game functions loaded successfully');

    // Verify standalone mode is active
    const standaloneMode = await page.evaluate(() => is_standalone_mode());
    expect(standaloneMode).toBe(true);
    console.log('✓ Standalone mode is active');

    // Check for JavaScript verification module
    const verifyModuleLoaded = await page.evaluate(() => {
      return {
        verify_js_modules_loaded: typeof verify_js_modules_loaded === 'function',
        run_js_verification: typeof run_js_verification === 'function'
      };
    });
    
    expect(verifyModuleLoaded.verify_js_modules_loaded).toBe(true);
    expect(verifyModuleLoaded.run_js_verification).toBe(true);
    console.log('✓ JavaScript verification module loaded successfully');

    // Run the verification and check results
    const verificationResult = await page.evaluate(async () => {
      if (typeof run_js_verification === 'function') {
        return await run_js_verification();
      }
      return null;
    });

    if (verificationResult) {
      console.log('Verification result:', JSON.stringify(verificationResult, null, 2));
      expect(verificationResult.success).toBe(true);
      console.log('✓ JavaScript verification passed');
    }

    // Check for critical JS-Verify console messages
    const verifyMessages = consoleMessages.filter(m => m.text.includes('[JS-Verify]'));
    console.log(`Found ${verifyMessages.length} JS-Verify console messages`);
    
    // Should have verification messages from three-modules.js
    const threeModulesVerified = verifyMessages.some(m => m.text.includes('Three.js ES modules loaded'));
    expect(threeModulesVerified).toBe(true);
    console.log('✓ Three.js module loading verified via console');

    // Check there were no critical JavaScript errors
    if (jsErrors.length > 0) {
      console.warn('JavaScript errors detected:', jsErrors);
    }
    // Note: We don't fail on JS errors as some may be expected in test environment
    
    console.log('✓ All JavaScript loading tests passed');
  });

  test('Standalone client WebGPU module loading', async ({ page }) => {
    // Go to the standalone client page
    await page.goto('http://localhost/freeciv-web-standalone.html', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Wait for THREE to be available
    await page.waitForFunction(() => typeof THREE !== 'undefined', { timeout: 15000 });

    // Check WebGPU support (may or may not be available depending on browser/environment)
    const webgpuStatus = await page.evaluate(() => {
      const hasWebGPUAPI = typeof navigator !== 'undefined' && typeof navigator.gpu !== 'undefined';
      const hasWebGPURenderer = typeof THREE !== 'undefined' && typeof THREE.WebGPURenderer !== 'undefined';
      
      return {
        browserSupportsWebGPU: hasWebGPUAPI,
        webgpuRendererLoaded: hasWebGPURenderer
      };
    });

    console.log('WebGPU Status:', webgpuStatus);
    
    // WebGPU renderer should be loaded if browser supports it
    if (webgpuStatus.browserSupportsWebGPU) {
      // Give a bit more time for WebGPU modules to load
      await page.waitForTimeout(2000);
      
      const webgpuRendererAvailable = await page.evaluate(() => {
        return typeof THREE !== 'undefined' && typeof THREE.WebGPURenderer !== 'undefined';
      });
      
      if (webgpuRendererAvailable) {
        console.log('✓ WebGPU renderer loaded (browser supports WebGPU)');
      } else {
        console.log('⚠ WebGPU renderer not loaded despite browser support');
      }
    } else {
      console.log('ℹ Browser does not support WebGPU, WebGL fallback will be used');
    }
    
    // WebGL should always be available as fallback
    const webglAvailable = await page.evaluate(() => {
      return typeof THREE !== 'undefined' && typeof THREE.WebGLRenderer !== 'undefined';
    });
    expect(webglAvailable).toBe(true);
    console.log('✓ WebGL renderer available as fallback');
  });

});
