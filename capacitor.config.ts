import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.secretalmanac.app',
  appName: 'Secret Almanac',
  webDir: 'dist',
  backgroundColor: '#121A36',
  android: { allowMixedContent: false },
};

export default config;
