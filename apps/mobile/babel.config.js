/** Expo owns production transforms; Jest needs async imports lowered to its CommonJS mock runtime. */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    env: {
      test: {
        plugins: [function jestDynamicImports() {
          return {
            // Installed Babel CommonJS supports async require after this dynamic-import capability marker.
            // Keep this test-only: Metro must retain its normal lazy module loading in app builds.
            pre() { this.file.set('@babel/plugin-proposal-dynamic-import', true); },
          };
        }],
      },
    },
  };
};
