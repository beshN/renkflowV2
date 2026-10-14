/** Verify dynamic PDF worker assets in every server trace, then execute the packaged reader. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const app = path.resolve(__dirname, '..');
const root = path.resolve(app, '../..');
const required = ['api/v1/orders/foy', 'api/v1/inventory/count-import', 'api/v1/ai/extract'];
function traces(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const file = path.join(dir, e.name);
    return e.isDirectory() ? traces(file) : e.name === 'route.js.nft.json' ? [file] : [];
  });
}
async function main() {
  const server = path.join(app, '.next/server/app');
  const checked = new Set();
  for (const file of traces(path.join(server, 'api'))) {
    const route = path.relative(server, path.dirname(file)).split(path.sep).join('/');
    const trace = JSON.parse(fs.readFileSync(file, 'utf8'));
    const traced = trace.files.map(f => path.resolve(path.dirname(file), f));
    const reader = traced.find(f => f.endsWith('/pdfjs-dist/legacy/build/pdf.mjs'));
    if (!reader) continue;
    checked.add(route);
    const worker = path.join(path.dirname(reader), 'pdf.worker.mjs');
    assert.ok(traced.includes(worker), `${route}: PDF worker is missing from the server trace`);
    const packaged = path.join(app, '.next/standalone', path.relative(root, reader));
    assert.ok(fs.existsSync(path.join(path.dirname(packaged), 'pdf.worker.mjs')), `${route}: worker missing from standalone output`);
    console.log('PASS packaged PDF worker: /' + route);
  }
  for (const route of required) assert.ok(checked.has(route), `${route}: PDF reader is missing from the server trace`);
  // Import from the actual deployable tree, not the source node_modules that masks this failure.
  const packagedReader = path.join(app, '.next/standalone/apps/web/node_modules/pdfjs-dist/legacy/build/pdf.mjs');
  const pdf = await import(pathToFileURL(packagedReader).href);
  const bytes = new Uint8Array(fs.readFileSync(path.join(app, '__tests__/fixtures/foy/pergola-two-systems.pdf')));
  const doc = await pdf.getDocument({ data: bytes, isEvalSupported: false, disableFontFace: true, useSystemFonts: false, verbosity: 0 }).promise;
  try {
    const content = await (await doc.getPage(1)).getTextContent();
    const text = content.items.filter(i => 'str' in i).map(i => i.str).join(' ');
    assert.match(text, /PDF TEST FABRİKA/);
    assert.ok(doc.numPages >= 1);
    console.log('PASS standalone PDF extraction: real manufacturing sheet, embedded Turkish text');
  } finally { await doc.destroy(); }
}
main().catch(e => { console.error(e.message); process.exit(1); });
