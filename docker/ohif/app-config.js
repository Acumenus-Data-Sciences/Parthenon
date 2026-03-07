/** OHIF Viewer configuration for Parthenon.
 *  Served as a static file — OHIF reads window.config on boot.
 *  Orthanc DICOMweb is proxied through Parthenon's nginx at /orthanc/.
 */
window.config = {
  routerBasename: '/ohif/',
  customizationService: {},
  extensions: [],
  modes: [],
  showStudyList: true,
  maxNumberOfWebWorkers: 3,
  showWarningMessageForCrossOrigin: false,
  showCPUFallbackMessage: true,
  strictZSpacingForVolumeViewport: true,
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
