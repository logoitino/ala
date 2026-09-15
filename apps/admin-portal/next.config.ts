import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@tapuai/shared-types'],
};

export default nextConfig;
