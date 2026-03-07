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
  maxNumberOfWebWorkers: 3,
  showWarningMessageForCrossOrigin: false,
  showCPUFallbackMessage: false,
  strictZSpacingForVolumeViewport: true,

  // Only load the requested study — do not fetch prior studies for the same patient
  studyPrefetcher: {
    enabled: false,
  },

  investigationalUseDialog: {
    option: 'never',
  },

  studyListFunctionsEnabled: true,

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
