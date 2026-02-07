const fs = require('node:fs');
const path = require('node:path');

const TRACE_FILES = [
  path.resolve('.next/next-server.js.nft.json'),
  path.resolve('.next/next-minimal-server.js.nft.json'),
];

const FROM_PREFIX = '../../../node_modules/';
const TO_PREFIX = '../node_modules/';

let updatedCount = 0;
const missing = [];

for (const traceFile of TRACE_FILES) {
  if (!fs.existsSync(traceFile)) {
    continue;
  }

  const payload = JSON.parse(fs.readFileSync(traceFile, 'utf8'));
  if (!Array.isArray(payload.files)) {
    continue;
  }

  let changed = false;
  payload.files = payload.files.map((filePath) => {
    if (typeof filePath !== 'string') {
      return filePath;
    }
    if (filePath.startsWith(FROM_PREFIX)) {
      changed = true;
      return `${TO_PREFIX}${filePath.slice(FROM_PREFIX.length)}`;
    }
    return filePath;
  });

  if (changed) {
    fs.writeFileSync(traceFile, JSON.stringify(payload));
    updatedCount += 1;
  }

  const traceDir = path.dirname(traceFile);
  for (const tracedFile of payload.files) {
    if (typeof tracedFile !== 'string' || !tracedFile.startsWith('../node_modules/')) {
      continue;
    }
    const absoluteTracedPath = path.resolve(traceDir, tracedFile);
    if (!fs.existsSync(absoluteTracedPath)) {
      missing.push(`${path.relative(process.cwd(), traceFile)} -> ${tracedFile}`);
      if (missing.length >= 20) {
        break;
      }
    }
  }
  if (missing.length >= 20) {
    break;
  }
}

if (missing.length > 0) {
  console.error('Trace normalization failed; missing files after rewrite:');
  for (const item of missing) {
    console.error(`- ${item}`);
  }
  process.exit(1);
}

console.log(`Trace normalization complete. Updated ${updatedCount} root trace file(s).`);
