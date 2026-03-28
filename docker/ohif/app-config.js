/** OHIF Viewer configuration for Parthenon.
 *  Served as a static file — OHIF reads window.config on boot.
 *  Orthanc DICOMweb is proxied through Parthenon's nginx at /orthanc/.
 */
window.config = {
  routerBasename: '/ohif/',

  // White-labeling: remove default OHIF branding
  whiteLabeling: {
    createLogoComponentFn: function () { return null; },
  },

  customizationService: {},

  extensions: [],
  modes: [],
  showStudyList: true,
  showLoadingIndicator: true,

  // Performance: more workers = faster parallel DICOM decoding
  maxNumberOfWebWorkers: navigator.hardwareConcurrency || 6,

  showWarningMessageForCrossOrigin: false,
  showCPUFallbackMessage: true,
  useSharedArrayBuffer: 'AUTO',
  strictZSpacingForVolumeViewport: false,

  // Only load the requested study — do not fetch prior studies
  studyPrefetcher: {
    enabled: false,
  },

  investigationalUseDialog: {
    option: 'never',
  },

  studyListFunctionsEnabled: true,

  // Cornerstone performance settings
  cornerstoneExtensionConfig: {
    tools: {
      // Use GPU-accelerated rendering
      useNorm16Texture: true,
      preferSizeOverAccuracy: true,
    },
  },

  defaultDataSourceName: 'orthanc',
  dataSources: [
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomweb',
      sourceName: 'orthanc',
      configuration: {
        friendlyName: 'Orthanc PACS',
        name: 'orthanc',
        wadoUriRoot: '/orthanc/wado',
        qidoRoot: '/orthanc/dicom-web',
        wadoRoot: '/orthanc/dicom-web',
        qidoSupportsIncludeField: false,
        supportsReject: false,
        imageRendering: 'wadors',
        thumbnailRendering: 'wadors',
        enableStudyLazyLoad: true,
        supportsFuzzyMatching: false,
        supportsWildcard: true,
        dicomUploadEnabled: true,
        bulkDataURI: {
          enabled: true,
        },
        omitQuotationForMultipartRequest: true,
      },
    },
  ],
};
