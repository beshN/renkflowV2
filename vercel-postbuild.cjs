const fs = require('node:fs');
const path = require('node:path');

const TRACE_FILES = [
  path.resolve('.next/next-server.js.nft.json'),
  path.resolve('.next/next-minimal-server.js.nft.json'),
];

const FROM_PREFIX = '../../../node_modules/';
const ROOT_NODE_MODULES_PREFIX = '../node_modules/';
const APP_NODE_MODULES_PREFIX = '../apps/web/node_modules/';

let updatedCount = 0;
let unresolvedCount = 0;

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
      const moduleSuffix = filePath.slice(FROM_PREFIX.length);
      const rootCandidate = `${ROOT_NODE_MODULES_PREFIX}${moduleSuffix}`;
      const appCandidate = `${APP_NODE_MODULES_PREFIX}${moduleSuffix}`;
      const rootCandidateAbs = path.resolve(path.dirname(traceFile), rootCandidate);
      const appCandidateAbs = path.resolve(path.dirname(traceFile), appCandidate);

      if (fs.existsSync(rootCandidateAbs)) {
        changed = true;
        return rootCandidate;
      }
      if (fs.existsSync(appCandidateAbs)) {
        changed = true;
        return appCandidate;
      }

      changed = true;
      unresolvedCount += 1;
      return rootCandidate;
    }
    return filePath;
  });

  if (changed) {
    fs.writeFileSync(traceFile, JSON.stringify(payload));
    updatedCount += 1;
  }

}

if (unresolvedCount > 0) {
  console.warn(`Trace normalization completed with ${unresolvedCount} unresolved node_modules entries.`);
}

console.log(`Trace normalization complete. Updated ${updatedCount} root trace file(s).`);
