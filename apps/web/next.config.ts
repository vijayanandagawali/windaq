import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  // The former "live" roulette tables had no live dealer (an automated Math.random wheel with a
  // stock video). They now point to the provably fair automated roulette.
  async redirects() {
    return ['/games/live-roulette', '/games/lightning-roulette', '/games/live-casino', '/dealer'].map((source) => ({
      source,
      destination: '/games/european-roulette',
      permanent: false,
    }));
  },
  async rewrites() {
    return [
      {
        source: '/games/colour-prediction',
        destination: '/games/color-prediction',
      },
      {
        source: '/promos',
        destination: '/promotions',
      },
    ];
  },
};

export default nextConfig;
