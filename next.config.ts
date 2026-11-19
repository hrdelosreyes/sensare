import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/the-ritual",
        destination: "/pages/the-sensare-ritual",
        permanent: true,
      },
      // Nov 2026 catalogue: renamed and retired products
      { source: "/shop/intimate-indulgence", destination: "/shop/two-hearts", permanent: true },
      { source: "/shop/lovers-gift-set", destination: "/shop", permanent: true },
    ];
  },
};

export default nextConfig;
