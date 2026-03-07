/**
 * Parthenon ↔ OHIF Measurement Bridge
 *
 * Injected into OHIF's index.html. Detects measurements made in the viewer
 * and relays them to the Parthenon parent frame via window.postMessage.
 * The parent (OhifViewer.tsx) listens and saves them to the imaging API.
 */
(function () {
  'use strict';
  if (window.parent === window) return; // Not in an iframe — do nothing

  function sanitizeMeasurement(m) {
    return {
      uid: m.uid || m.id || '',
      SOPInstanceUID: m.SOPInstanceUID || '',
      SeriesInstanceUID: m.SeriesInstanceUID || '',
      StudyInstanceUID: m.StudyInstanceUID || '',
      label: m.label || m.text || '',
      type: m.toolName || m.type || 'unknown',
      displayText: m.displayText || [],
      length: m.length != null ? m.length : null,
      area: m.area != null ? m.area : null,
      longestDiameter: m.longestDiameter != null ? m.longestDiameter : null,
      shortestDiameter: m.shortestDiameter != null ? m.shortestDiameter : null,
      mean: m.mean != null ? m.mean : null,
      stdDev: m.stdDev != null ? m.stdDev : null,
      min: m.min != null ? m.min : null,
      max: m.max != null ? m.max : null,
      unit: m.unit || 'mm',
    };
  }

  function setupBridge() {
    var attempts = 0;
    var maxAttempts = 60; // 60 seconds

    var checkInterval = setInterval(function () {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(checkInterval);
        return;
      }

      try {
        // OHIF v3 exposes the services manager on window
        var servicesManager =
          (window.ohif && window.ohif.app && window.ohif.app.servicesManager) ||
          (window.__ohif_app__ && window.__ohif_app__.servicesManager);

        if (!servicesManager) return;

        var ms = servicesManager.services
          ? servicesManager.services.measurementService
          : null;

        if (!ms) return;

        clearInterval(checkInterval);

        // Subscribe to measurement lifecycle events
        if (ms.EVENTS && ms.subscribe) {
          ms.subscribe(ms.EVENTS.MEASUREMENT_ADDED, function (evt) {
            window.parent.postMessage(
              { type: 'ohif:measurement:added', payload: sanitizeMeasurement(evt.measurement || evt) },
              '*'
            );
          });

          ms.subscribe(ms.EVENTS.MEASUREMENT_UPDATED, function (evt) {
            window.parent.postMessage(
              { type: 'ohif:measurement:updated', payload: sanitizeMeasurement(evt.measurement || evt) },
              '*'
            );
          });

          ms.subscribe(ms.EVENTS.MEASUREMENT_REMOVED, function (evt) {
            window.parent.postMessage(
              { type: 'ohif:measurement:removed', payload: { measurementId: evt.measurementId || evt.uid } },
              '*'
            );
          });
        }

        // Notify parent that bridge is ready
        window.parent.postMessage({ type: 'ohif:bridge:ready' }, '*');
        console.log('[Parthenon Bridge] OHIF measurement bridge active');
      } catch (e) {
        // Services not ready yet — retry
      }
    }, 1000);
  }

  /**
   * Cornerstone viewports initialize with size 0 inside iframes because the
   * iframe layout hasn't finalized when OHIF's ViewportGrid first measures.
   *
   * Root cause: OHIF's ViewportGrid uses react-resize-detector, which fires
   * once during mount. If the measurement is 0 (iframe not painted yet),
   * CornerstoneViewportService.resize() bails and viewports never render.
   *
   * Fix: Force the entire OHIF layout chain to have explicit heights, then
   * trigger a layout reflow + resize event so react-resize-detector re-fires.
   */
  function forceViewportResize() {
    console.log('[Parthenon Bridge] Starting viewport resize watcher');
    var resizeAttempts = 0;
    var maxResizeAttempts = 40; // 40 × 500ms = 20s
    var fixed = false;

    var resizeInterval = setInterval(function () {
      resizeAttempts++;
      if (resizeAttempts > maxResizeAttempts || fixed) {
        clearInterval(resizeInterval);
        if (!fixed) console.log('[Parthenon Bridge] Resize watcher timed out');
        return;
      }

      // Force the full height chain — some browsers don't apply CSS in time
      // for the first React render inside an iframe
      var heightTargets = ['html', 'body', '#root'];
      for (var h = 0; h < heightTargets.length; h++) {
        var el = document.querySelector(heightTargets[h]);
        if (el && el.offsetHeight === 0) {
          el.style.height = '100vh';
          el.style.minHeight = '100vh';
        }
      }

      // Walk all children of #root and ensure flex containers have height
      var root = document.getElementById('root');
      if (root) {
        var stack = [root];
        while (stack.length > 0) {
          var node = stack.pop();
          if (node.nodeType !== 1) continue;
          var style = window.getComputedStyle(node);
          // Fix any flex container in the chain that has 0 height
          if (style.display === 'flex' && node.offsetHeight === 0) {
            node.style.height = '100%';
            node.style.minHeight = '0';
          }
          // Only walk the first few children to avoid deep traversal
          var kids = node.children;
          for (var k = 0; k < Math.min(kids.length, 5); k++) {
            stack.push(kids[k]);
          }
        }
      }

      // Force layout reflow then dispatch resize
      if (document.body) {
        void document.body.offsetHeight; // force reflow
      }
      window.dispatchEvent(new Event('resize'));

      // Check for canvases with valid dimensions
      var canvases = document.querySelectorAll('canvas');
      for (var i = 0; i < canvases.length; i++) {
        if (canvases[i].width > 0 && canvases[i].height > 0) {
          console.log('[Parthenon Bridge] Viewport rendered (' + canvases[i].width + 'x' + canvases[i].height + ') after ' + resizeAttempts + ' attempts');
          fixed = true;
          clearInterval(resizeInterval);
          return;
        }
      }

      if (resizeAttempts % 4 === 0) {
        var panes = document.querySelectorAll('[data-cy="viewport-pane"]');
        var grid = document.querySelector('[data-cy="viewport-grid"]');
        var rootChild = root ? root.firstElementChild : null;

        // Log the full layout chain heights for debugging
        var chain = 'Chain: html=' + document.documentElement.offsetHeight +
          ' body=' + document.body.offsetHeight +
          ' #root=' + (root ? root.offsetHeight : 'N/A') +
          ' rootChild=' + (rootChild ? rootChild.offsetHeight + '(' + rootChild.className.substring(0,40) + ')' : 'N/A') +
          ' grid=' + (grid ? grid.offsetHeight : 'N/A');
        console.log('[Parthenon Bridge] Attempt ' + resizeAttempts +
          ', panes: ' + panes.length +
          ', canvases: ' + canvases.length +
          ' | ' + chain);
      }
    }, 500);
  }

  // Start viewport resize fix immediately — does NOT depend on servicesManager
  forceViewportResize();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupBridge);
  } else {
    setupBridge();
  }
})();
