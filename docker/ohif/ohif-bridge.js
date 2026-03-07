/**
 * Parthenon <-> OHIF Measurement Bridge + Viewport Resize Fix
 *
 * Injected into OHIF's index.html. Two responsibilities:
 *
 * 1. Measurement Bridge: Detects measurements made in the viewer and relays
 *    them to the Parthenon parent frame via window.postMessage.
 *
 * 2. Viewport Resize Fix: OHIF's Cornerstone viewports initialize with size 0
 *    inside iframes because the layout hasn't finalized when ViewportGrid first
 *    measures. This script forces the height chain and dispatches resize events
 *    until viewports render. See: CornerstoneViewportService.ts:144
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

  // ── Measurement Bridge ──────────────────────────────────────────────
  function setupBridge() {
    var attempts = 0;
    var maxAttempts = 60;

    var checkInterval = setInterval(function () {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(checkInterval);
        return;
      }

      try {
        var servicesManager =
          (window.ohif && window.ohif.app && window.ohif.app.servicesManager) ||
          (window.__ohif_app__ && window.__ohif_app__.servicesManager);

        if (!servicesManager) return;

        var ms = servicesManager.services
          ? servicesManager.services.measurementService
          : null;

        if (!ms) return;

        clearInterval(checkInterval);

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

        window.parent.postMessage({ type: 'ohif:bridge:ready' }, '*');
        console.log('[Parthenon Bridge] Measurement bridge active');
      } catch (e) {
        // Services not ready yet — retry
      }
    }, 1000);
  }

  // ── Viewport Resize Fix ─────────────────────────────────────────────
  // OHIF's ViewportGrid uses react-resize-detector which fires once on mount.
  // Inside an iframe, the initial measurement is often 0 because the iframe
  // layout hasn't finalized. CornerstoneViewportService.resize() bails on
  // size 0 and never retries. This fix ensures the height chain is intact
  // and dispatches resize events until viewports render.
  function forceViewportResize() {
    var resizeAttempts = 0;
    var maxResizeAttempts = 40; // 40 x 500ms = 20s
    var fixed = false;

    var resizeInterval = setInterval(function () {
      resizeAttempts++;
      if (resizeAttempts > maxResizeAttempts || fixed) {
        clearInterval(resizeInterval);
        return;
      }

      // Ensure html/body/#root have height (CSS may not apply before first render)
      var heightTargets = ['html', 'body', '#root'];
      for (var h = 0; h < heightTargets.length; h++) {
        var el = document.querySelector(heightTargets[h]);
        if (el && el.offsetHeight === 0) {
          el.style.height = '100vh';
          el.style.minHeight = '100vh';
        }
      }

      // Force reflow then dispatch resize for react-resize-detector
      if (document.body) {
        void document.body.offsetHeight;
      }
      window.dispatchEvent(new Event('resize'));

      // Check if any canvas has rendered with non-zero dimensions
      var canvases = document.querySelectorAll('canvas');
      for (var i = 0; i < canvases.length; i++) {
        if (canvases[i].width > 0 && canvases[i].height > 0) {
          console.log('[Parthenon Bridge] Viewport rendered (' +
            canvases[i].width + 'x' + canvases[i].height +
            ') after ' + resizeAttempts + ' attempts');
          fixed = true;
          clearInterval(resizeInterval);
          return;
        }
      }
    }, 500);
  }

  // Start resize fix immediately (does NOT depend on servicesManager)
  forceViewportResize();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupBridge);
  } else {
    setupBridge();
  }
})();
