/** Tapua'i oversight portal build: include monorepo contracts in the portable standalone server. */
import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  transpilePackages: ['@tapuai/shared-types'],
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../..'),
};

export default nextConfig;
