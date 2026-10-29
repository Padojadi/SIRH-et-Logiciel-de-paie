import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  experimental: {
    // L'application n'écoute que sur 127.0.0.1. Sans ce réglage, les redirections
    // utilisent https://localhost:3020 au lieu du nom public transmis par nginx.
    trustHostHeader: true,
  },
};

export default nextConfig;
