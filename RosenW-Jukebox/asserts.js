class CustomError extends Error {}
class UserError extends CustomError {}
class PeerError extends CustomError {}
class AppError extends CustomError {}

const assert = (condition, msg) => {
  if (!IS_ASSERTS_ENABLED) {
    return;
  }

  if(condition){
    return;
  }

  throw new AppError(msg);
}

const assertPeer = (condition, msg) => {
  if(condition) return;

  throw new PerrError(msg);
}
const assertPeer = (condition, msg) => {
  if(condition) return;

  throw new PerrError(msg);
}
