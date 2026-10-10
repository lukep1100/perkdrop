const fs = require('node:fs');
module.exports = ({config}) => {
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON;
  if (googleServicesFile && !fs.existsSync(googleServicesFile)) throw Error('GOOGLE_SERVICES_JSON must name an existing private build file.');
  return {...config, android:{...config.android,...(googleServicesFile?{googleServicesFile}:{})}};
};
