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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupBridge);
  } else {
    setupBridge();
  }
})();
