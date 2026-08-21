import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hobah.bible',
  appName: 'Hobah',
  webDir: 'www',
  backgroundColor: '#F3EFE5',
  ios: {
    contentInset: 'never',
    allowsLinkPreview: false,
    preferredContentMode: 'mobile'
  },
  server: {
    iosScheme: 'capacitor'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: false,
      backgroundColor: '#F3EFE5',
      showSpinner: false
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#F3EFE5',
      overlaysWebView: false
    }
  }
};

export default config;
