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
    for (const probe of ['expo-router', 'expo', 'react-native', 'react']) {
      const entry = path.join(dir, probe);
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

config.watchFolders = [workspaceRoot, ...linked];
config.resolver.nodeModulesPaths = [...new Set([...localModules, ...linked])];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
