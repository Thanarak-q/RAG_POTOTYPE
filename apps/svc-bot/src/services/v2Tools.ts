import type { SalesAgentTools } from '@line-rag/agent';

export function createPlaceholderSalesTools(): SalesAgentTools {
  return {
    async findProducts() {
      return [];
    },
    async retrieveChunks() {
      return [];
    },
    async createLead() {
      return { id: 'placeholder-lead' };
    },
    async persistTurn() {
      return undefined;
    },
  };
}
