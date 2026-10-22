/**
 * METRO-01 exercises the installed Expo renderer and HTTP cancellation boundary.
 * Expo navigation/font fixtures isolate real React streaming; no app data or credentials load.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { test } from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const mobile = createRequire(path.join(root, 'apps/mobile/package.json'));
const cli = createRequire(mobile.resolve('@expo/cli/package.json'));
const router = createRequire(cli.resolve('@expo/router-server/package.json'));
const { convertRequest, respond } = cli('expo-server/adapter/http');
const React = mobile('react');
const rendererPath = router.resolve('./build/server/renderStreamingContent.js');

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

// Only Expo's surrounding navigation/resources are fixtures. React and SDK code run unchanged.
function loadRenderer(element, errors = [], renderImplementation) {
  const identity = ({ children }) => children;
  const fixtures = {
    'expo-font/build/server': {
      withServerContext: (fn) => fn(), getServerResourceDescriptors: () => [],
    },
    'expo-router': { ExpoRoot: identity },
    'expo-router/_ctx': { ctx: {} },
    'expo-router/head': { Provider: identity },
    'expo-router/internal/server': { ServerDocument: identity },
    'expo-router/internal/static': {
      getRouteInfoForLocation: () => ({ pathname: '/', params: {} }),
      registerStaticRootComponent: () => ({ element, getStyleElement: () => null }),
      InnerRoot: identity,
    },
    '../static/getRootComponent': { getRootComponent: () => identity },
    '../utils/debug': { createDebug: () => () => {} },
    '../utils/react': {
      createInjectedCssAsNodes: () => ({ headNodes: [] }),
      createInjectedScriptAsNodes: () => ({ headNodes: [], bodyNodes: [] }),
      createInjectedFontsAsNodes: () => null,
      getBootstrapContents: () => '',
    },
    './metadata': { resolveMetadata: () => ({}) },
  };
  if (renderImplementation) fixtures['react-dom/server'] = { renderToReadableStream: renderImplementation };
  const module = { exports: {} };
  const context = vm.createContext({
    module, exports: module.exports,
    require: (id) => Object.hasOwn(fixtures, id) ? fixtures[id] : router(id),
    console: { error: (...args) => errors.push(args) }, Response, ReadableStream,
  });
  vm.runInContext(fs.readFileSync(rendererPath, 'utf8'), context, { filename: rendererPath });
  return module.exports.getStreamingContent;
}

function pendingRenderer() {
  const entered = deferred();
  const pending = new Promise(() => {});
  function Waiting() { entered.resolve(); React.use(pending); return null; }
  return { render: loadRenderer(React.createElement(Waiting)), entered: entered.promise };
}

test('disconnect before the shell is ready completes without reaching Metro error handling',
  { timeout: 5000 }, async (t) => {
    const { render, entered } = pendingRenderer();
    const finished = deferred();
    const reports = [];
    let webRequest;
    const server = http.createServer(async (req, res) => {
      webRequest = convertRequest(req, res);
      try {
        const content = await render(new URL(webRequest.url), { request: webRequest });
        await respond(res, new Response(content), { signal: webRequest.signal });
      } catch (error) {
        reports.push(error); // Metro's wrapper/overlay would see any rejected render here.
      } finally { finished.resolve(); }
    });
    await new Promise((done) => server.listen(0, '127.0.0.1', done));
    t.after(() => { server.closeAllConnections(); server.close(); });
    const client = http.get(`http://127.0.0.1:${server.address().port}/`);
    client.on('error', () => {}); // An intentionally disconnected socket reports ECONNRESET.
    await entered;
    client.destroy();
    await finished.promise;
    assert.equal(webRequest.signal.aborted, true);
    assert.equal(webRequest.signal.reason.name, 'AbortError');
    assert.match(webRequest.signal.reason.stack, /convertRequest|http\.js/);
    assert.deepEqual(reports, []);
  });

test('a connected request streams normal HTML', async () => {
  const render = loadRenderer(React.createElement('div', null, 'Tapua’i'));
  const content = await render(new URL('http://localhost/'), { request: new Request('http://localhost/') });
  assert.match(await new Response(content).text(), /Tapua’i/);
});

test('static export keeps its text result', async () => {
  const render = loadRenderer(React.createElement('div', null, 'export'));
  assert.match(await render(new URL('http://localhost/'), { output: 'static' }), /export/);
});

test('a pre-aborted default request returns an empty readable stream', async () => {
  const controller = new AbortController();
  controller.abort();
  const request = new Request('http://localhost/', { signal: controller.signal });
  const stream = await loadRenderer(React.createElement('div'))(new URL(request.url), { request });
  assert.equal(await new Response(stream).text(), '');
});

test('a null abort reason stays null rather than becoming a reporting error', async () => {
  const controller = new AbortController();
  controller.abort(null);
  const request = new Request('http://localhost/', { signal: controller.signal });
  const render = loadRenderer(React.createElement('div'), [], async () => { throw null; });
  await assert.rejects(render(new URL(request.url), { request }), (error) => error === null);
});

for (const scenario of ['unrelated AbortError', 'renderer failure after disconnect', 'transport error', 'static export abort']) {
  test(`${scenario} remains a rejected render`, async () => {
    const controller = new AbortController();
    const request = new Request('http://localhost/', { signal: controller.signal });
    let error;
    let options = { request };
    if (scenario === 'unrelated AbortError') {
      controller.abort();
      error = new DOMException('Different operation', 'AbortError');
    } else if (scenario === 'renderer failure after disconnect') {
      controller.abort(); error = new Error('Real render failure');
    } else if (scenario === 'transport error') {
      error = new Error('Real transport failure'); controller.abort(error);
    } else {
      controller.abort(); error = request.signal.reason; options = { request, output: 'static' };
    }
    // A controlled rejection tests reason identity at the real SDK catch, independently of
    // React's pre-aborted fast path (which always throws the signal's reason).
    const render = loadRenderer(React.createElement('div'), [], async () => { throw error; });
    await assert.rejects(render(new URL(request.url), options), (actual) => actual === error);
  });
}

test('a genuine connected render failure still rejects and reports', async () => {
  const error = new Error('Broken connected renderer');
  const reports = [];
  function Broken() { throw error; }
  const render = loadRenderer(React.createElement(Broken), reports);
  await assert.rejects(render(new URL('http://localhost/'), { request: new Request('http://localhost/') }),
    (actual) => actual === error);
  assert.equal(reports.length, 1);
});

test('cancelling an already readable stream still releases React work', { timeout: 5000 }, async () => {
  const controller = new AbortController();
  const request = new Request('http://localhost/', { signal: controller.signal });
  function Late() { React.use(new Promise(() => {})); return null; }
  const element = React.createElement('div', null, 'shell',
    React.createElement(React.Suspense, { fallback: 'loading' }, React.createElement(Late)));
  const stream = await loadRenderer(element)(new URL(request.url), { request });
  // React's allReady rejects on cancellation; observe it before aborting.
  const allReady = stream.allReady.catch(() => {});
  await stream.getReader().cancel();
  controller.abort();
  await allReady;
});
