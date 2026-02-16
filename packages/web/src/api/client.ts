const API_BASE = "";

export async function apiFetch<T>(
  path: string,
  params?: Record<string, string>,
): Promise<T> {
  const url = new URL(path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v) url.searchParams.set(k, v);
    });
  }

  const initData = window.Telegram?.WebApp?.initData ?? "";

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `tma ${initData}`,
    },
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  return res.json();
}
