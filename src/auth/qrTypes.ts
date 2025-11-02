// auth/qrTypes.ts
export type QrPayload = { sid: string; nonce: string; sig: string };

export const isQrPayload = (x: unknown): x is QrPayload =>
  !!x &&
  typeof x === "object" &&
  "sid" in x &&
  typeof (x as any).sid === "string" &&
  "nonce" in x &&
  typeof (x as any).nonce === "string" &&
  "sig" in x &&
  typeof (x as any).sig === "string";
