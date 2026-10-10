/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lets end-to-end tests run beside a development server without sharing build output.
  distDir: process.env.NEXT_DIST_DIR || '.next',
};

export default nextConfig;

