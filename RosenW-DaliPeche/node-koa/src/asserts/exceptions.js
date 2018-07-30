class CustomError extends Error { // TODO code + default code
  constructor (err) {
    super(err);
  }
}
class UserError extends CustomError {
  constructor (err, statusCode) {
    super(err);
    this.statusCode = statusCode;
  }
}

class PeerError extends CustomError {
  constructor (err, statusCode) {
    super(err);
    this.statusCode = statusCode;
  }
}

class AppError extends CustomError {
  constructor (err, statusCode) {
    super(err);
    this.statusCode = statusCode;
  }
}

module.exports = {
  UserError,
  PeerError,
  AppError,
};
