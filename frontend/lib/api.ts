export class APIError extends Error {
  constructor(
    public code: string,
    message: string,
    public requestId?: string
  ) {
    super(message);
  }
}

import { flushMutations, queueMutation, QueuedMutation } from "./offline";

function emptyResponse(path: string): unknown {
  const cleanPath = path.split("?")[0];
  if (cleanPath === "/auth/me") {
    return {
      email: null,
      full_name: null,
      employee_code: null,
      role_name: null,
      permissions: [],
    };
  }
  if (cleanPath === "/people") {
    return { employees: [], roles: [], projects: [] };
  }
  if (cleanPath === "/reports/overview") {
    return {
      metrics: {
        tasks_total: 0,
        average_progress: 0,
        open_snags: 0,
        low_stock_items: 0,
      },
      exceptions: [],
    };
  }
  if (cleanPath === "/ai/briefing") {
    return {
      answer: "No project records are available yet to generate a briefing.",
      mode: "deterministic",
    };
  }
  if (cleanPath.startsWith("/workflow/")) {
    return { items: [], next_offset: null };
  }
  return { items: [] };
}

async function send(path: string, init: RequestInit = {}): Promise<Response> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) throw new Error("NEXT_PUBLIC_API_URL is not configured");
  return fetch(`${baseUrl}/api/v1${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Request-ID": crypto.randomUUID(),
      ...init.headers,
    },
  });
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method || "GET").toUpperCase();
  if (!process.env.NEXT_PUBLIC_API_URL) {
    return emptyResponse(path) as T;
  }
  if (
    typeof navigator !== "undefined" &&
    !navigator.onLine &&
    method !== "GET"
  ) {
    const queued = queueMutation(path, init);
    return { queued: true, client_mutation_id: queued.id } as T;
  }
  let response: Response;
  try {
    response = await send(path, init);
  } catch (error) {
    if (typeof navigator !== "undefined" && method !== "GET") {
      const queued = queueMutation(path, init);
      return { queued: true, client_mutation_id: queued.id } as T;
    }
    throw error;
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new APIError(
      body?.error?.code ?? "REQUEST_FAILED",
      body?.error?.message ?? "The request could not be completed.",
      body?.error?.request_id
    );
  }
  return response.json() as Promise<T>;
}

export async function syncOfflineQueue(): Promise<number> {
  return flushMutations(async (item: QueuedMutation) => {
    const response = await send(item.path, {
      method: item.method,
      body: item.body,
    });
    if (!response.ok) throw new Error("Mutation could not be synchronized");
  });
}
