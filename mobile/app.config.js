const fs = require('node:fs');
module.exports = ({config}) => {
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON;
  if (googleServicesFile && !fs.existsSync(googleServicesFile)) throw Error('GOOGLE_SERVICES_JSON must name an existing private build file.');
  // The notification plugin adds an APNs entitlement even when runtime push is off.
  // Keep signing capabilities aligned with the explicitly enabled build features.
  // Expo executes entitlement mods in reverse registration order.
  const plugins = ['./plugins/with-push-capability', ...(config.plugins || [])];
  return {...config, plugins, android:{...config.android,...(googleServicesFile?{googleServicesFile}:{})}};
};
