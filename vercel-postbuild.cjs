const fs = require('node:fs');
const path = require('node:path');

const NEXT_DIR = path.resolve('.next');
const APP_NODE_MODULES_DIR = path.resolve('apps/web/node_modules');
const ROOT_NODE_MODULES_DIR = path.resolve('node_modules');

function listTraceFiles(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      listTraceFiles(fullPath, out);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.nft.json')) {
      out.push(fullPath);
    }
  }
  return out;
}

function normalizeSlashes(value) {
  return value.split(path.sep).join('/');
}

function extractModuleSuffix(fileRef) {
  if (typeof fileRef !== 'string') {
    return null;
  }
  let match = fileRef.match(/^(?:\.\.\/)*node_modules\/(.+)$/);
  if (match) {
    return match[1];
  }
  match = fileRef.match(/^(?:\.\.\/)*apps\/web\/node_modules\/(.+)$/);
  if (match) {
    return match[1];
  }
  return null;
}

function resolveTargetAbs(moduleSuffix) {
  const appTarget = path.resolve(APP_NODE_MODULES_DIR, moduleSuffix);
  if (fs.existsSync(appTarget)) {
    return appTarget;
  }
  const rootTarget = path.resolve(ROOT_NODE_MODULES_DIR, moduleSuffix);
  if (fs.existsSync(rootTarget)) {
    return rootTarget;
  }
  return null;
}

if (!fs.existsSync(NEXT_DIR)) {
  console.error('Missing .next directory; postbuild trace normalization aborted.');
  process.exit(1);
}

const traceFiles = listTraceFiles(NEXT_DIR);
let updatedFiles = 0;
let normalizedRefs = 0;

for (const traceFile of traceFiles) {
  const payload = JSON.parse(fs.readFileSync(traceFile, 'utf8'));
  if (!Array.isArray(payload.files)) {
    continue;
  }

  const traceDir = path.dirname(traceFile);
  let changed = false;
  payload.files = payload.files.map((fileRef) => {
    const moduleSuffix = extractModuleSuffix(fileRef);
    if (!moduleSuffix) {
      return fileRef;
    }

    const targetAbs = resolveTargetAbs(moduleSuffix);
    if (!targetAbs) {
      return fileRef;
    }

    const relativeTarget = normalizeSlashes(path.relative(traceDir, targetAbs));
    if (relativeTarget !== fileRef) {
      changed = true;
      normalizedRefs += 1;
      return relativeTarget;
    }

    return fileRef;
  });

  if (changed) {
    fs.writeFileSync(traceFile, JSON.stringify(payload));
    updatedFiles += 1;
  }
}

console.log(`Trace normalization complete. Updated ${updatedFiles} trace file(s), normalized ${normalizedRefs} node_modules reference(s).`);
