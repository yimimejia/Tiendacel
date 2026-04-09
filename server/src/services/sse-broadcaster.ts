import type { Response } from 'express';

const branchClients = new Map<number, Set<Response>>();

export function registerSSEClient(branchId: number, res: Response): () => void {
  if (!branchClients.has(branchId)) {
    branchClients.set(branchId, new Set());
  }
  branchClients.get(branchId)!.add(res);

  return () => {
    branchClients.get(branchId)?.delete(res);
    if (branchClients.get(branchId)?.size === 0) {
      branchClients.delete(branchId);
    }
  };
}

export function broadcastToBranch(branchId: number, event: string, data: Record<string, unknown>) {
  const clients = branchClients.get(branchId);
  if (!clients || clients.size === 0) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    try {
      client.write(payload);
    } catch {
      clients.delete(client);
    }
  }
}
