const yamlParser = require('js-yaml');
const { assertUser, UserError } = require('./error-handling');
const { log } = require('./utils');
const { isObject } = require('lodash');

function parseYAML (yaml) {
  try {
    return yamlParser.safeLoad(yaml);
  } catch (error) {
    throw new UserError('Invalid input format. Cannot parse YAML.');
  }
}

function stringifyYAML (yaml) {
  log(yaml);
  const parsed = yamlParser.safeDump(yaml);
  log(parsed);
  return parsed;
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
    params: yaml.parameters,
    id: yaml.id
  };
}

function formYAMLResponse (normalized, result) {
  return {
    yamlrpc: normalized.yamlrpc,
    id: normalized.id,
    result: result
  };
}

function formJSONResponse (normalized, result) {
  return {
    jsonrpc: normalized.jsonrpc,
    id: normalized.id,
    result: result
  };
}

function normalize (body, contentType, format) {
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
}

function denormalize (normalized, result, contentType, format) {
  if (contentType === 'application/json') {
    assertUser(
      format === 'json' ||
      !format,
      'Ambiguous content type.'
    );

    return JSON.stringify(formJSONResponse(normalized, result));
  } else if (contentType === 'text/yaml') {
    assertUser(
      format === 'yaml' ||
      !format,
      'Ambiguous content type.'
    );

    return stringifyYAML(formYAMLResponse(normalized, result));
  } else if (!contentType) {
    if (format === 'json') {
      return JSON.stringify(formJSONResponse(normalized, result));
    } else if (format === 'yaml') {
      return stringifyYAML(formYAMLResponse(normalized, result));
    } else {
      throw new UserError('Unknown content type.');
    }
  } else {
    throw new UserError('Unknown content type.');
  }
}

module.exports = {
  normalize,
  denormalize
};
