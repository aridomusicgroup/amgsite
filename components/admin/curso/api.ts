/** fetch JSON para el editor de cursos: lanza con el mensaje del servidor si falla. */
export async function api<T = Record<string, unknown>>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Error");
  return data as T;
}

export const errorDe = (e: unknown, def = "Algo salió mal"): string => (e instanceof Error ? e.message : def);
