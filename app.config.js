// app.json holds the config. This file only adds Firebase (needed for push
// notifications on Android) once google-services.json has been placed next to it,
// so Android builds keep working before Firebase is set up.
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const firebase = path.join(__dirname, 'google-services.json');
  if (fs.existsSync(firebase)) {
    config.android = { ...config.android, googleServicesFile: './google-services.json' };
  }
  return config;
};
