const Module = require('node:module');

const originalResolveFilename = Module._resolveFilename;
const serverOnlyEmptyModule = require.resolve('next/dist/compiled/server-only/empty');

Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  if (request === 'server-only') return serverOnlyEmptyModule;
  return originalResolveFilename.call(this, request, parent, isMain, options);
};
