class BaseError extends Error {}
class ApplicationError extends BaseError {}
// TODO AppError

function assert (condition, error, ...args) {
  if (!condition) {
    throw new error(...args);
  }
}

const assertApp = (condition, message) => assert(condition, ApplicationError, message);

module.exports = {
  BaseError,
  ApplicationError,
  assertApp
};
