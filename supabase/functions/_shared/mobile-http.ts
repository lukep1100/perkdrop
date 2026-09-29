export const mobileHeaders = {
  'Content-Type': 'application/json', 'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': 'https://perkdrop.au',
  'Access-Control-Allow-Headers': 'content-type, authorization, x-perkdrop-identity',
  'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Referrer-Policy': 'no-referrer',
};
export const respond = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: mobileHeaders });
export const tokenValid = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export async function hashSecret(value: string) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(b => b.toString(16).padStart(2, '0')).join('');
}
export async function sameSecret(actual: string, expected: string) {
  if (!actual || !expected) return false;
  const a = await hashSecret(actual), b = await hashSecret(expected);
  let diff = 0; for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
export async function readBody(req: Request) {
  const reader = req.body?.getReader();
  if (!reader) throw Error('invalid_json');
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const next = await reader.read(); if (next.done) break;
    size += next.value.byteLength;
    if (size > 16384) { await reader.cancel(); throw Error('body_too_large'); }
    chunks.push(next.value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  const body = JSON.parse(new TextDecoder().decode(bytes));
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw Error('invalid_json');
  return body;
}
