const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
// Resolve PDF.js from react-pdf, rather than the independently installed extraction package.
const fromViewer=createRequire(require.resolve('react-pdf/package.json'));
const root=path.dirname(fromViewer.resolve('pdfjs-dist/package.json'));
fs.copyFileSync(path.join(root,'build/pdf.worker.min.mjs'),path.join(__dirname,'../public/pdf.worker.min.mjs'));
console.log('PDF viewer worker synchronized:',JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version);
