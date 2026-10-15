export class RequestError extends Error {
  constructor(message, status = 0) { super(message); this.name = 'RequestError'; this.status = status; }
}
// The timer covers response parsing too. Mutating requests are never auto-retried.
export async function fetchJson(url, options = {}, timeoutMs = 12000, fetcher = fetch) {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new RequestError('The connection timed out. Please try again.')); }, timeoutMs);
  });
  const operation = (async () => {
    const response = await fetcher(url, { ...options, signal: controller.signal });
    let payload;
    try { payload = await response.json(); } catch { throw new RequestError('The server returned an unreadable response.', response.status); }
    if (!response.ok) {
      const message = typeof payload?.error === 'string' ? payload.error.replaceAll('_', ' ').slice(0, 140) : 'The request could not be completed.';
      throw new RequestError(message, response.status);
    }
    return payload;
  })();
  try { return await Promise.race([operation, timeout]); }
  finally { clearTimeout(timer); }
}
