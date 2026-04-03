import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output = smaller Vercel bundle, faster cold starts
  output: "standalone",

  // Required for Prisma to work in Vercel serverless functions
  serverExternalPackages: ["@prisma/client", "prisma"],

  reactCompiler: true,
  cacheComponents: true,

  experimental: {
    // Optimise server actions for production
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },

  // Security headers for all routes
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options",    value: "nosniff" },
          { key: "X-Frame-Options",            value: "DENY" },
          { key: "X-XSS-Protection",           value: "1; mode=block" },
          { key: "Referrer-Policy",            value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy",         value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
