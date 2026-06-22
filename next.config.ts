import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/the-ritual",
        destination: "/pages/the-sensare-ritual",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
