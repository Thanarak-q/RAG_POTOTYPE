const nextConfig = {
  outputFileTracingRoot: new URL('../..', import.meta.url).pathname,
  transpilePackages: ['@line-rag/ui'],
};

export default nextConfig;
