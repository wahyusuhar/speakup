// Learn more https://docs.expo.dev/guides/customizing-metro
// expo-sqlite web setup: https://docs.expo.dev/versions/v58.0.0/sdk/sqlite/#web-setup
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add wasm asset support (expo-sqlite on web uses a WebAssembly build of SQLite)
config.resolver.assetExts.push('wasm');

// Add COEP and COOP headers to support SharedArrayBuffer (dev server only;
// production headers are set in vercel.json)
config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    middleware(req, res, next);
  };
};

module.exports = config;
