const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Add the shared package to watchFolders so Metro can detect changes
config.watchFolders = [
  path.resolve(__dirname, '../../packages/shared'),
];

// Configure resolver to handle the shared package
config.resolver = {
  ...config.resolver,
  extraNodeModules: {
    '@dating-app/shared': path.resolve(__dirname, '../../packages/shared'),
  },
};

module.exports = config;












