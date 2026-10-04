import fs from "node:fs";
import path from "node:path";
const roots=["app","lib"];
let failures=0;
function scan(dir:string) {
 for (const entry of fs.readdirSync(dir,{withFileTypes:true})) {
  const file=path.join(dir,entry.name);
  if (entry.isDirectory()) scan(file);
  else if (/\.(ts|tsx|js|mjs)$/.test(file) && /@google-cloud\/storage|@\/lib\/storage\/gcs|new Storage\(/.test(fs.readFileSync(file,"utf8"))) {console.error(`[backend] Google Cloud dependency: ${file}`);failures++;}
 }
}
roots.forEach(scan);
if (failures) process.exitCode=1;
else console.log("[backend] Vercel runtime guard passed");
