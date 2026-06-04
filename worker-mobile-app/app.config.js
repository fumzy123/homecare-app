const APP_ENV = process.env.APP_ENV ?? 'development'
const IS_STAGING = APP_ENV === 'staging'
const IS_DEV = APP_ENV === 'development'

const appName = IS_DEV
  ? 'HomeCare Worker (Dev)'
  : IS_STAGING
  ? 'HomeCare Worker (Staging)'
  : 'HomeCare Worker'

const bundleId = IS_DEV
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
        'expo-location',
        {
          locationWhenInUsePermission:
            'Allow HomeCare Worker to use your location to verify visit check-ins.',
        },
      ],
      [
        'expo-notifications',
        {
          icon: './assets/icon.png',
          color: '#FF5A1F',
        },
      ],
      'expo-splash-screen',
      'expo-web-browser',
    ],
    ios: {
      supportsTablet: false,
      bundleIdentifier: bundleId,
    },
    android: {
      package: bundleId,
      adaptiveIcon: {
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundColor: '#F2EEE5',
      },
      predictiveBackGestureEnabled: false,
      softwareKeyboardLayoutMode: 'pan',
      permissions: [
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.ACCESS_FINE_LOCATION',
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
