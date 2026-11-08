// Retry only read-only token acquisition. Never retry a notification send.
export async function readPushToken(getToken, {attempts = 2, timeoutMs = 12000, wait = ms => new Promise(resolve => setTimeout(resolve, ms))} = {}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    let timer;
    try {
      return await Promise.race([
        Promise.resolve().then(getToken),
        new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Push token request timed out.')), timeoutMs); }),
      ]);
    } catch {
      if (attempt === attempts - 1) throw Error('Your phone could not register for alerts. Check your connection and try again.');
    } finally { clearTimeout(timer); }
    await wait(500);
  }
}

export function createPushReconciler({buildEnabled, readConsent, readPendingDisable, clearConsent, getPermissions, hasPermission, service, getToken, validToken, disable, runPrivate}) {
  let pending;
  let queuedNativeToken;
  const reconcile = nativeToken => {
    if (pending) { if (nativeToken) queuedNativeToken = nativeToken; return pending; }
    pending = runPrivate(async check => {
      if (await readPendingDisable()) return disable();
      if (!buildEnabled || !await readConsent()) return;
      const permissions = await getPermissions();
      check();
      if (!hasPermission(permissions)) return disable();
      const capabilities = await service('capabilities');
      check();
      if (!capabilities.push_enabled) return;
      const status = await service('push_status');
      check();
      if (!status.enabled) { await clearConsent(); return; }
      const token = await readPushToken(() => getToken(nativeToken));
      check();
      // Opt-out can begin while Expo is resolving the token. It always wins.
      if (await readPendingDisable() || !await readConsent()) return;
      check();
      if (!validToken(token)) throw Error('This phone returned an invalid notification registration.');
      // The server refreshes an existing enabled registration. It cannot opt in.
      const result = await service('push_refresh', {token});
      check();
      if (result.enabled === false) await clearConsent();
      return result;
    }).finally(() => {
      pending = undefined;
      if (queuedNativeToken) {
        const next = queuedNativeToken;
        queuedNativeToken = undefined;
        reconcile(next).catch(() => {});
      }
    });
    return pending;
  };
  return reconcile;
}

export function createNotificationResponseConsumer({defaultAction, readLast, remember, clear, parseLink, onLink, onExpired}) {
  let stopped = false;
  let tail = Promise.resolve();
  const seen = new Set();
  const consume = response => {
    const result = tail.then(async () => {
      if (stopped || !response || response.actionIdentifier !== defaultAction) return;
      const id = response.notification?.request?.identifier;
      if (!id || seen.has(id) || id === await readLast()) return;
      if (stopped) return;
      const link = parseLink(response.notification.request.content.data);
      seen.add(id);
      if (seen.size > 100) seen.delete(seen.values().next().value);
      // Route while mounted before persisting the ID; cleanup cannot consume a
      // notification without also delivering its navigation/expired result.
      if (link) onLink(link); else onExpired();
      try { await remember(id); } finally { await clear(); }
    });
    tail = result.catch(() => {});
    return result;
  };
  return {consume, stop: () => { stopped = true; }};
}
