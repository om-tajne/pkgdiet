/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin monorepo workspace root to eliminate Next.js root-detection warning
  outputFileTracingRoot: new URL("../../", import.meta.url).pathname,
};

export default nextConfig;
