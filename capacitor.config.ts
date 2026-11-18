import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.aurora.alvorada",
  appName: "Aurora",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
};

export default config;
