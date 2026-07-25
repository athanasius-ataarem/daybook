// Thin fetch wrapper. The client switches on `code`, never on `message`.

export interface ApiResult<T> {
  status: number; // 0 = network unreachable
  ok: boolean;
  code: string | null;
  data: T | null;
}

export async function api<T>(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`/api${path}`, {
      method: init?.method ?? 'GET',
      credentials: 'include',
      headers: init?.body !== undefined ? { 'Content-Type': 'application/json' } : {},
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    let payload: unknown = null;
    const text = await res.text();
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }
    }
    if (!res.ok) {
      const code =
        payload && typeof payload === 'object' && 'error' in payload
          ? String((payload as { error: { code?: string } }).error.code ?? '')
          : null;
      return { status: res.status, ok: false, code, data: null };
    }
    return { status: res.status, ok: true, code: null, data: payload as T };
  } catch {
    return { status: 0, ok: false, code: null, data: null };
  }
}
