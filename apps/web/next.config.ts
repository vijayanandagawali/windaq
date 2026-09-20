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
  async rewrites() {
    return [
      {
        source: '/games/colour-prediction',
        destination: '/games/color-prediction',
      },
      {
        source: '/games/lightning-roulette',
        destination: '/games/live-roulette',
      },
      {
        source: '/promos',
        destination: '/promotions',
      },
    ];
  },
};

export default nextConfig;
