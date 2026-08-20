import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hobah.bible',
  appName: 'Hobah',
  webDir: 'www',
  bundledWebRuntime: false,
  backgroundColor: '#F3EFE5',
  server: {
    iosScheme: 'capacitor',
    allowNavigation: ['modern-ethiopian-bible-81.vercel.app']
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
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
