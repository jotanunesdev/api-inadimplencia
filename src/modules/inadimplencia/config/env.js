const { resolvePrefixedEnv } = require('../../../shared/moduleEnv');
const dotenv = require('dotenv');

dotenv.config();

const env = resolvePrefixedEnv('INAD');

module.exports = {
  env,
};
