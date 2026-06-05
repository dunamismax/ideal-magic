import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

import { getServerActionAllowedOrigins } from "./src/features/security/origin";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: getServerActionAllowedOrigins(),
    },
  },
  turbopack: {
    root: fileURLToPath(new URL("../..", import.meta.url)),
  },
  typescript: {
    ignoreBuildErrors: false,
    tsconfigPath: "tsconfig.json",
  },
};

export default nextConfig;
