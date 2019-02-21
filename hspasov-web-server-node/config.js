const fs = require('fs');
const Ajv = require('ajv');
const {
  log,
  errorLogLevels: {
    ERROR,
  },
} = require('./logger.js');
let CONFIG;

// TODO use assert
if (!process.env.CONFIG) {
  log.error(ERROR, { msg: 'expected env CONFIG' });
  process.exit(1);
}

try {
  const configFileContent = fs.readFileSync(process.env.CONFIG, {
    encoding: 'utf-8',
  });

  CONFIG = JSON.parse(configFileContent);

  const configSchemaPath = './config_schema.json';

  const configFileSchemaContent = fs.readFileSync(configSchemaPath, {
    encoding: 'utf-8',
  });

  const configFileSchemaParsed = JSON.parse(configFileSchemaContent);

  const ajv = new Ajv();

  const valid = ajv.validate(configFileSchemaParsed, CONFIG);

  if (!valid) {
    throw new Error(ajv.errors);
  }
} catch (error) {
  log.error(ERROR, { msg: error });
  process.exit(1);
}

module.exports = CONFIG;
