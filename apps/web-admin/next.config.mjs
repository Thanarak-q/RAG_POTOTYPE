const nextConfig = {
  outputFileTracingRoot: new URL('../..', import.meta.url).pathname,
  transpilePackages: ['@line-rag/shared'],
};

export default nextConfig;
