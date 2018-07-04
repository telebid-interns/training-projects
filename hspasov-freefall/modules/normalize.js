const yamlParser = require('js-yaml');
const { assertUser, UserError } = require('./error-handling');
const isObject = require('./is-object');

function parseYAML (yaml) {
  try {
    return yamlParser.safeLoad(yaml);
  } catch (error) {
    throw new UserError('Invalid input format. Cannot parse YAML.');
  }
}

function normalizeYAML (yaml) {
  assertUser(
    isObject(yaml) &&
    isObject(yaml.parameters) &&
    typeof yaml.yamlrpc === 'string' &&
    typeof yaml.action === 'string',
    'Invalid input format.'
  );

  return {
    yamlrpc: yaml.yamlrpc,
    method: yaml.action,
    params: yaml.parameters
  };
}

module.exports = function normalize (body, contentType, format) {
  let normalized;

  if (contentType === 'application/json') {
    assertUser(
      format === 'json' ||
      !format,
      'Ambiguous content type.'
    );

    normalized = body;
  } else if (contentType === 'text/yaml') {
    assertUser(
      format === 'yaml' ||
      !format,
      'Ambiguous content type.'
    );

    normalized = normalizeYAML(parseYAML(body));
  } else if (!contentType) {
    if (format === 'json') {
      normalized = body;
    } else if (format === 'yaml') {
      normalized = normalizeYAML(parseYAML(body));
    } else {
      throw new UserError('Unknown content type.');
    }
  } else {
    throw new UserError('Unknown content type.');
  }

  assertUser(
    isObject(normalized) &&
    typeof normalized.method === 'string' &&
    isObject(normalized.params),
    'Invalid input format.'
  );

  return normalized;
};
