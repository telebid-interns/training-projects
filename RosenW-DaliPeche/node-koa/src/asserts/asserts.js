const { AppError, PeerError, UserError } = require('./exceptions.js');

const assert = (condition, msg) => {
  if (condition) {
    return;
  }

  throw new AppError(msg);
};

const assertPeer = (condition, msg) => {
  if (condition) return;

  throw new PeerError(msg);
};

const assertUser = (condition, msg) => {
  if (condition) return;

  throw new UserError(msg);
};

module.exports = {
    assert,
    assertUser,
    assertPeer,
  };
