const { AppError, PeerError, UserError } = require('./exceptions.js');

const assert = (condition, msg, statusCode) => {
  if (condition) {
    return;
  }

  throw new AppError(msg, statusCode);
};

const assertPeer = (condition, msg, statusCode) => {
  if (condition) return;

  throw new PeerError(msg, statusCode);
};

const assertUser = (condition, msg, statusCode) => {
  if (condition) return;

  throw new UserError(msg, statusCode);
};

module.exports = {
    assert,
    assertUser,
    assertPeer,
  };
