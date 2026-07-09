const path = require('path');
const dotenv = require('dotenv');

const isProduction =
  process.env.NODE_ENV === 'production' ||
  process.env.APP_ENV === 'production' ||
  Boolean(process.env.VERCEL);

const envFile = isProduction ? '.env' : '.env.local';

dotenv.config({
  path: path.resolve(__dirname, '..', envFile)
});

module.exports = {
  isProduction,
  envFile
};
