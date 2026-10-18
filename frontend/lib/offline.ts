export type QueuedMutation = {
  id: string;
  path: string;
  method: string;
  body?: string;
  createdAt: string;
  attempts: number;
};

const KEY = "buildlens.offline-mutations.v1";

export function queuedMutations(): QueuedMutation[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) || "[]") as QueuedMutation[]; }
  catch { return []; }
}

export function queueMutation(path: string, init: RequestInit): QueuedMutation {
  const mutation: QueuedMutation = {
    id: crypto.randomUUID(),
    path,
    method: init.method || "POST",
    body: typeof init.body === "string" ? init.body : undefined,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };
  localStorage.setItem(KEY, JSON.stringify([...queuedMutations(), mutation]));
  window.dispatchEvent(new CustomEvent("buildlens:queue-change"));
  return mutation;
}

export async function flushMutations(sender: (item: QueuedMutation) => Promise<void>): Promise<number> {
  const pending = queuedMutations();
  const remaining: QueuedMutation[] = [];
  let synced = 0;
  for (const item of pending) {
    try { await sender(item); synced += 1; }
    catch { remaining.push({ ...item, attempts: item.attempts + 1 }); }
  }
  localStorage.setItem(KEY, JSON.stringify(remaining));
  window.dispatchEvent(new CustomEvent("buildlens:queue-change"));
  return synced;
}
