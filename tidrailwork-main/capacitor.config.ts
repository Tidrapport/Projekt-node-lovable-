import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.opero-system',
  appName: 'Opero-System AB',
  webDir: 'dist',
  server: {
    url: 'http://localhost:8080',
    cleartext: true
  }
};

export default config;
