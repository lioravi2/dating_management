/**
 * Expo App Configuration
 * Loads environment variables from .env file
 */

const fs = require('fs');
const path = require('path');

// Load environment variables from .env file if it exists
function loadEnvFile() {
  const envPath = path.join(__dirname, '.env');
  const envLocalPath = path.join(__dirname, '.env.local');
  
  // Try .env.local first, then .env
  const envFile = fs.existsSync(envLocalPath) ? envLocalPath : 
                  fs.existsSync(envPath) ? envPath : null;
  
  if (!envFile) {
    return {};
  }
  
  try {
    const envContent = fs.readFileSync(envFile, 'utf8');
    const envVars = {};
    
    // Simple .env parser (handles basic KEY=VALUE format)
    envContent.split('\n').forEach(line => {
      line = line.trim();
      // Skip comments and empty lines
      if (!line || line.startsWith('#')) {
        return;
      }
      
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();
        
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        
        envVars[key] = value;
        // Also set in process.env so Expo can access it
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    });
    
    return envVars;
  } catch (error) {
    console.warn(`Could not load .env file: ${error.message}`);
    return {};
  }
}

// Load environment variables
loadEnvFile();

module.exports = {
  expo: {
    name: "mobile",
    slug: "mobile",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    scheme: "datingapp",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.datingapp.mobile"
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: "com.datingapp.mobile",
      intentFilters: [
        {
          action: "VIEW",
          autoVerify: true,
          data: [
            {
              scheme: "datingapp",
              host: "auth",
              pathPrefix: "/callback"
            }
          ],
          category: ["BROWSABLE", "DEFAULT"]
        },
        {
          action: "SEND",
          data: [
            {
              mimeType: "image/*"
            }
          ],
          category: ["DEFAULT"]
        }
      ]
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    extra: {
      // Make environment variables available via expo-constants
      // These will be accessible via Constants.expoConfig.extra
      amplitudeApiKey: process.env.EXPO_PUBLIC_AMPLITUDE_API_KEY,
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      webAppUrl: process.env.EXPO_PUBLIC_WEB_APP_URL,
    }
  }
};

