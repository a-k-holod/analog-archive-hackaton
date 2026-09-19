import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tesseract.js uses workers/WASM; keep it client-bundled, not server-resolved.
  serverExternalPackages: ["tesseract.js"],
};

export default nextConfig;
