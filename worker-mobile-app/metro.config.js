const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Supabase 2.106.1's ESM tracing import cannot be compiled by Hermes.
// Its official CommonJS build includes the Hermes fix; use it on native only.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@supabase/supabase-js' && (platform === 'android' || platform === 'ios')) {
    return { type: 'sourceFile', filePath: require.resolve('@supabase/supabase-js') };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
