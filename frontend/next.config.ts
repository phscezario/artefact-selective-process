import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Linting is its own CI step (`npm run lint`, also part of `npm run verify`).
  // Next 15 would otherwise run a second ESLint pass with its own config
  // resolution, which is noisy in a monorepo and duplicates the gate.
  eslint: { ignoreDuringBuilds: true },

  // The tRPC router is a workspace package that ships TypeScript sources (no build step),
  // so Next has to compile it as part of the application bundle.
  transpilePackages: ['@artefact/backend'],

  // Produces a self-contained server bundle for the Docker image.
  output: 'standalone',
  // In a monorepo the trace has to start at the repository root, otherwise the
  // generated bundle misses the workspace package that holds the router.
  outputFileTracingRoot: path.join(__dirname, '..'),
};

export default nextConfig;
