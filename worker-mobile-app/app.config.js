// Service environments are local, staging and production. EAS profile names
// and NODE_ENV describe build/tooling choices, not additional services.
const APP_ENV = process.env.APP_ENV ?? 'local'
if (!['local', 'staging', 'production'].includes(APP_ENV)) {
  throw new Error('APP_ENV must be local, staging or production')
}
const IS_STAGING = APP_ENV === 'staging'
const IS_LOCAL = APP_ENV === 'local'

const appName = IS_LOCAL
  ? 'Care Harbor (Dev)'
  : IS_STAGING
  ? 'Care Harbor (Staging)'
  : 'Care Harbor'

const bundleId = IS_LOCAL
  ? 'com.homecareapp.worker.dev'
  : IS_STAGING
  ? 'com.homecareapp.worker.staging'
  : 'com.homecareapp.worker'

module.exports = {
  expo: {
    name: appName,
    slug: 'worker-mobile-app',
    version: '1.0.0',
    scheme: 'worker-mobile-app',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    plugins: [
      'expo-router',
      'expo-font',
      'expo-secure-store',
      [
        'expo-notifications',
        {
          icon: './assets/notification-icon.png',
          color: '#FF5A1F',
        },
      ],
      'expo-splash-screen',
      'expo-status-bar',
      'expo-web-browser',
    ],
    ios: {
      supportsTablet: false,
      bundleIdentifier: bundleId,
    },
    android: {
      package: bundleId,
      // EAS file variables resolve to a temporary path on the build runner.
      ...(process.env.GOOGLE_SERVICES_JSON
        ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON }
        : IS_STAGING ? { googleServicesFile: './google-services.staging.json' } : {}),
      adaptiveIcon: {
        foregroundImage: './assets/android-icon-foreground.png',
        monochromeImage: './assets/android-icon-monochrome.png',
        backgroundColor: '#F2EEE5',
      },
      predictiveBackGestureEnabled: false,
      softwareKeyboardLayoutMode: 'pan',
      // GPS/attendance is deferred. Prevent dependencies from adding location access.
      blockedPermissions: [
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.ACCESS_BACKGROUND_LOCATION',
      ],
    },
    web: {
      bundler: 'metro',
      favicon: './assets/favicon.png',
    },
    experiments: {
      typedRoutes: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: '124a574b-172d-4691-b959-b54a474f78ae',
      },
    },
  },
}
