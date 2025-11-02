export type QrPayload = {
  baseUrl: string;
  type: "magic" | "token";
  code?: string;
  token?: string;
};

export function parseQr(text: string): QrPayload | null {
  try {
    const obj = JSON.parse(text);
    if (!obj.baseUrl) return null;
    return obj as QrPayload;
  } catch {
    try {
      const url = new URL(text);
      const baseUrl = url.searchParams.get("baseUrl") ?? undefined;
      const code = url.searchParams.get("code") ?? undefined;
      if (!baseUrl) return null;
      return { baseUrl, type: "magic", code } as QrPayload;
    } catch {
      return null;
    }
  }
}
