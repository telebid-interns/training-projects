class CustomError extends Error {
  constructor (err) {
    super(err);
  }
}
class UserError extends CustomError {
  constructor (err) {
    super(err);
  }
}

class PeerError extends CustomError {
  constructor (err) {
    super(err);
  }
}

class AppError extends CustomError {}

module.exports = {
  UserError,
  PeerError,
  AppError,
};
