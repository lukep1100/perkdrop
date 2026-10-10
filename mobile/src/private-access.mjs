// Requests from a previous device identity must never restore private UI data
// after pairing or deletion. This guard does not replace server authorisation.
export function createPrivateAccessGuard() {
  let revision = 0;
  let changing = false;
  const check = stamp => {
    if (changing || stamp !== revision) throw Error('Your private access changed. Please retry.');
  };
  return {
    async run(operation) {
      const stamp = revision;
      check(stamp);
      const result = await operation(() => check(stamp));
      check(stamp);
      return result;
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
