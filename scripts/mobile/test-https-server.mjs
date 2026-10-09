// Test-only loopback TLS bridge. Temporary certificate/key and fictional credentials stay outside git.
import https from 'node:https';
import http from 'node:http';
import { readFileSync } from 'node:fs';
const [fixture, certificate, key] = process.argv.slice(2);
if (!fixture || !certificate || !key) throw new Error('Usage: test-https-server fixture cert key');
https.createServer({ cert: readFileSync(certificate), key: readFileSync(key) }, (request, response) => {
  if (request.url === '/fixture') { response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); response.end(readFileSync(fixture)); return; }
  const upstream = http.request({ hostname: '127.0.0.1', port: 3022, method: request.method, path: request.url, headers: request.headers }, result => {
    response.writeHead(result.statusCode, result.headers); result.pipe(response);
  });
  upstream.on('error', () => { response.writeHead(502); response.end(); });
  request.pipe(upstream);
}).listen(3043, '127.0.0.1');
