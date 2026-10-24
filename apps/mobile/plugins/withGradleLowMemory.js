/**
 * EAS Android: cap Gradle parallelism on medium builders.
 * Preview already builds only device ABIs; workers=2 avoids the Skia/Reanimated
 * daemon OOM and long silent hangs seen on assembleRelease.
 */
const { withGradleProperties, createRunOncePlugin } = require('expo/config-plugins');

/**
 * @param {import('expo/config-plugins').ExportedConfig} config
 */
function withGradleLowMemory(config) {
  return withGradleProperties(config, (cfg) => {
    const props = [
      { type: 'property', key: 'org.gradle.parallel', value: 'false' },
      { type: 'property', key: 'org.gradle.workers.max', value: '2' },
    ];
    for (const prop of props) {
      const index = cfg.modResults.findIndex((item) => item.type === 'property' && item.key === prop.key);
      if (index >= 0) cfg.modResults[index] = prop;
      else cfg.modResults.push(prop);
    }
    return cfg;
  });
}

module.exports = createRunOncePlugin(withGradleLowMemory, 'withGradleLowMemory', '1.0.0');
