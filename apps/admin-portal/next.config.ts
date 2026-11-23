/** Portable oversight server; private portal documents refuse indexing, embedding and shared caching. */
import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  transpilePackages: ['@tapuai/shared-types'],
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../..'),
  async headers() {
    return [{
      // Font/script/image assets retain Next's immutable asset caching.
      source: '/((?!_next/static|_next/image|favicon.ico|icon.png).*)',
      headers: [
        { key: 'Cache-Control', value: 'private, no-store, max-age=0, must-revalidate' },
        { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
      ],
    }];
  },
};

export default nextConfig;
