import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: 'http://localhost:3001/api/v1/:path*',
      },
      {
        source: '/admin',
        destination: 'http://localhost:3001/admin/index.html',
      },
      {
        source: '/admin/',
        destination: 'http://localhost:3001/admin/index.html',
      },
      {
        source: '/admin/:path*',
        destination: 'http://localhost:3001/admin/:path*',
      },
      {
        source: '/css/:path*',
        destination: 'http://localhost:3001/css/:path*',
      },
      {
        source: '/js/:path*',
        destination: 'http://localhost:3001/js/:path*',
      },
      {
        source: '/assets/:path*',
        destination: 'http://localhost:3001/assets/:path*',
      },
    ];
  },
};

export default nextConfig;
