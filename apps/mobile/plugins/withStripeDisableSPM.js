/**
 * EAS / prebuild: opt Stripe RN out of SPM so Install pods works when Expo
 * forces static linkage for most pods (useFrameworks dynamic is not enough —
 * Expo disables USE_FRAMEWORKS for ~90 pods including stripe-react-native).
 * $StripeDisableSPM uses CocoaPods for stripe-ios (deprecated by Stripe but
 * required until Expo keeps stripe as a dynamic framework).
 */
const { withDangerousMod, createRunOncePlugin } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = '$StripeDisableSPM = true';

/**
 * @param {import('expo/config-plugins').ExportedConfig} config
 */
function withStripeDisableSPM(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = await fs.promises.readFile(podfilePath, 'utf8');
      if (!contents.includes(MARKER)) {
        contents = `${MARKER}\n${contents}`;
        await fs.promises.writeFile(podfilePath, contents);
      }
      return cfg;
    },
  ]);
}

module.exports = createRunOncePlugin(
  withStripeDisableSPM,
  'withStripeDisableSPM',
  '1.0.0',
);
