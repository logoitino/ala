const fs = require('fs');
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

/**
 * @purpose Expo Metro config for the pnpm monorepo: watch packages/* and resolve deps from the workspace root.
 */
const config = getDefaultConfig(projectRoot);

const localModules = [path.resolve(projectRoot, 'node_modules'), path.resolve(workspaceRoot, 'node_modules')];

/**
 * Packages Metro must always find under pnpm (hierarchical lookup is off). Stripe.js is only imported from
 * `stripe.web.ts` / Checkout web hosts; without an explicit map Expo web fails with "Unable to resolve module
 * @stripe/stripe-js" when the installer hoists the real files under `node_modules/.pnpm`.
 */
const pinnedModules = [
  '@stripe/stripe-js',
  '@stripe/react-stripe-js',
  'expo-router',
  'expo',
  'react-native',
  'react',
];

/**
 * Resolve a workspace package to its real install folder (follows pnpm links). Missing packages are skipped.
 */
function resolvePackageRoot(name) {
  for (const dir of localModules) {
    const entry = path.join(dir, ...name.split('/'));
    try {
      return fs.realpathSync(entry);
    } catch {
      // Try the next node_modules root.
    }
  }
  return null;
}

/**
 * Git worktrees (for example `.claude/worktrees/<name>`) do not get their own install: their `node_modules` entries are
 * symlinks into the main checkout's `node_modules`, which sits outside this workspace root. Metro follows symlinks to
 * real paths and refuses files outside `watchFolders` ("Unable to resolve module …/expo-router/entry"), so this adds
 * the real folders those links point into. In the main checkout every link already resolves inside the workspace
 * root, so nothing is added and the config is exactly as before.
 */
function linkedModuleRoots() {
  const realWorkspace = fs.realpathSync(workspaceRoot);
  const inside = (dir) => dir === realWorkspace || dir.startsWith(realWorkspace + path.sep);
  const found = [];
  for (const dir of localModules) {
    for (const probe of pinnedModules) {
      const entry = path.join(dir, ...probe.split('/'));
      try {
        // The folder holding the link target (e.g. the main checkout's apps/mobile/node_modules).
        if (fs.lstatSync(entry).isSymbolicLink()) found.push(fs.realpathSync(path.dirname(path.resolve(dir, fs.readlinkSync(entry)))));
        // The pnpm store's node_modules that finally holds the package files.
        const real = fs.realpathSync(entry);
        const store = real.lastIndexOf(`${path.sep}node_modules${path.sep}.pnpm${path.sep}`);
        if (store >= 0) found.push(real.slice(0, store) + `${path.sep}node_modules`);
      } catch {
        // Probe package missing in this folder: nothing to add for it.
      }
    }
  }
  return [...new Set(found)].filter((dir) => !inside(dir));
}
const linked = linkedModuleRoots();

const extraNodeModules = {};
for (const name of pinnedModules) {
  const root = resolvePackageRoot(name);
  if (root) extraNodeModules[name] = root;
}

config.watchFolders = [workspaceRoot, ...linked];
config.resolver.nodeModulesPaths = [...new Set([...localModules, ...linked])];
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  ...extraNodeModules,
};
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
