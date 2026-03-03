// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Prevent test artifacts from triggering hot reloads during e2e tests
config.resolver.blockList = [
  ...(config.resolver.blockList || []),
  /screenshots\/.*/,
];

module.exports = config;
