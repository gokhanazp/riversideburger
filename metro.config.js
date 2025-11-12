// Metro configuration for React Native
// Learn more: https://reactnative.dev/docs/metro

const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Web için Stripe paketini exclude et (Exclude Stripe package for web)
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Web platformunda Stripe paketini yükleme (Don't load Stripe on web)
  if (platform === 'web' && moduleName.includes('@stripe/stripe-react-native')) {
    return {
      type: 'empty',
    };
  }

  // Varsayılan resolver'ı kullan (Use default resolver)
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

