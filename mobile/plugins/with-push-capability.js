const {withEntitlementsPlist} = require('expo/config-plugins');

module.exports = config => {
  if (process.env.EXPO_PUBLIC_PUSH_ENABLED === 'true') return config;
  return withEntitlementsPlist(config, mod => {
    delete mod.modResults['aps-environment'];
    return mod;
  });
};
