// Requests from a previous device identity must never restore private UI data
// after pairing or deletion. This guard does not replace server authorisation.
export function createPrivateAccessGuard() {
  let revision = 0;
  let changing = false;
  let active = 0;
  const waiting = [];
  const check = stamp => {
    if (changing || stamp !== revision) throw Error('Your private access changed. Please retry.');
  };
  return {
    async run(operation) {
      const stamp = revision;
      check(stamp);
      active += 1;
      try {
        const result = await operation(() => check(stamp));
        check(stamp);
        return result;
      } finally {
        active -= 1;
        if (active === 0) waiting.splice(0).forEach(resolve => resolve());
      }
    },
    async waitForPending() {
      if (active > 0) await new Promise(resolve => waiting.push(resolve));
    },
    beginChange() {
      if (changing) throw Error('Private access is being updated. Please wait for it to finish.');
      changing = true;
      revision += 1;
      let finished = false;
      return () => {
        if (!finished) { finished = true; changing = false; }
      };
    },
  };
}
