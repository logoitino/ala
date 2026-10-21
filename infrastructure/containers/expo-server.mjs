/**
 * Tapua'i production web/API host for Expo SDK 58 output:server exports.
 * Uses the locked expo-server adapter through expo-router; no runtime package install.
 * Private server configuration is injected by the process environment at startup.
 */
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, realpath } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const routerRequire = createRequire(require.resolve('expo-router/package.json'));
const { createRequestHandler } = routerRequire('expo-server/adapter/http');
const dist = resolve(process.env.EXPO_DIST_DIR || 'dist');
const client = await realpath(resolve(dist, 'client'));
const handler = createRequestHandler({ build: resolve(dist, 'server') });
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

/** Serve exported client assets while refusing traversal and symlinks escaping the client tree. */
async function serveAsset(req, res) {
  if (!['GET', 'HEAD'].includes(req.method)) return false;
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (pathname.includes('\0')) return false;
  const file = resolve(client, `.${pathname}`);
  if (!file.startsWith(client + sep)) return false;
  try {
    const actual = await realpath(file);
    if (!actual.startsWith(client + sep)) return false;
    const info = await stat(actual);
    if (!info.isFile()) return false;
    res.setHeader('Content-Type', types[extname(actual)] || 'application/octet-stream');
    res.setHeader('Content-Length', info.size);
    // Metro content-addressed bundles can survive deployments; HTML must be revalidated.
    res.setHeader('Cache-Control', pathname.startsWith('/_expo/static/') ? 'public, max-age=31536000, immutable' : 'no-cache');
    if (req.method === 'HEAD') res.end();
    else createReadStream(actual).on('error', () => res.destroy()).pipe(res);
    return true;
  } catch (error) {
    if (['ENOENT', 'ENOTDIR'].includes(error.code)) return false;
    throw error;
  }
}

const server = createServer(async (req, res) => {
  try {
    if (req.url === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end('{"status":"ok"}');
      return;
    }
    if (await serveAsset(req, res)) return;
    await handler(req, res, () => {
      if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Server request failed');
    });
  } catch {
    if (!res.headersSent) res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Invalid request');
  }
});
server.requestTimeout = 120_000;
server.headersTimeout = 30_000;
server.listen(Number(process.env.PORT || 8081), '0.0.0.0');
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 15_000).unref();
});
