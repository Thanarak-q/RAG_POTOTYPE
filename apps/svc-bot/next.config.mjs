const nextConfig = {
  outputFileTracingRoot: new URL('../..', import.meta.url).pathname,
  transpilePackages: ['@line-rag/shared', '@line-rag/llm-gateway'],
};

export default nextConfig;
