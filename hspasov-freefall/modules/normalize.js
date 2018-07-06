const YAMLParser = require('js-yaml');
const { assertPeer, PeerError } = require('./error-handling');
const { log } = require('./utils');
const { isObject, isFunction } = require('lodash');

function yamlParser () {
  const parseYAML = (yaml) => {
    try {
      return YAMLParser.safeLoad(yaml);
    } catch (error) {
      throw new PeerError('Invalid input format. Cannot parse YAML.');
    }
  };

  const normalizeYAML = (yaml) => {
    assertPeer(
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
  };

  const stringifyYAML = (yaml) => {
    const parsed = YAMLParser.safeDump(yaml);
    return parsed;
  };

  const execute = (data) => {
    const normalized = normalizeYAML(parseYAML(data));
    return {
      ...normalized,
      version: normalized.yamlrpc
    };
  };

  const stringify = (data, yamlrpc = '2.0', id = null) => {
    return stringifyYAML({ result: data, yamlrpc, id });
  };

  return {
    contentType: 'text/yaml',
    format: 'yaml',
    execute,
    stringify
  };
}

function jsonParser () {
  const execute = (data) => {
    return {
      ...data,
      version: data.jsonrpc
    };
  };

  const stringify = (data, jsonrpc = '2.0', id = null) => {
    return JSON.stringify({ jsonrpc, id, result: data });
  };

  return {
    contentType: 'application/json',
    format: 'json',
    execute,
    stringify
  };
}

function defineParsers (...args) {
  const parsers = args.map((arg) => arg());

  const parse = (data, type) => {
    assertPeer(
      isObject(type) &&
      (!type.contentType || typeof type.contentType === 'string') &&
      (!type.format || typeof type.format === 'string'),
      'Invalid content type.'
    );

    for (const parser of parsers) {
      if (parser.contentType === type.contentType) {
        assertPeer(
          parser.format === type.format ||
          !type.format,
          'Ambiguous content type.'
        );

        return parser.execute(data);
      } else if (parser.format === type.format) {
        assertPeer(
          parser.contentType === type.contentType ||
          !type.contentType,
          'Ambiguous content type.'
        );

        return parser.execute(data);
      }
    }
    throw new PeerError('Unknown content type.');
  };

  const stringify = (data, type, version, id) => {
    assertPeer(
      isObject(type) &&
      (!type.contentType || typeof type.contentType === 'string') &&
      (!type.format || typeof type.format === 'string'),
      'Invalid content type.'
    );

    for (const parser of parsers) {
      if (parser.contentType === type.contentType) {
        assertPeer(
          parser.format === type.format ||
          !type.format,
          'Ambiguous content type.'
        );

        return parser.stringify(data, version, id);
      } else if (parser.format === type.format) {
        assertPeer(
          parser.contentType === type.contentType ||
          !type.contentType,
          'Ambiguous content type.'
        );
        return parser.stringify(data, version, id);
      }
    }
    throw new PeerError('Unknown content type.');
  };

  return { parse, stringify };
}

module.exports = {
  defineParsers,
  jsonParser,
  yamlParser
};
