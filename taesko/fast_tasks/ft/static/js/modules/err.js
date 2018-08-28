class BaseError extends Error {
    constructor(userMsg, msg, code) {
        super();

        this.userMsg = userMsg;
        this.msg = msg;
        this.code = code;

        console.exception(this);
    }
}

class AppError extends BaseError {
}

class SystemError extends BaseError {
}

class PeerError extends BaseError {
}

class UserError extends BaseError {
}

function assert(
    condition,
    msg = null,
    userMsg = 'An error occurred and the application might stop behaving properly. Please refresh the page.',
) {
    if (!condition) {
        throw new AppError(userMsg, msg, null);
    }
}

function assertSystem(
    condition,
    msg = null,
    userMsg = 'Your browser version is not supported, please consider updating.',
) {
    if (!condition) {
        throw new SystemError(userMsg, msg, null);
    }
}

function assertPeer(
    condition,
    userMsg,
    code,
    msg,
) {
    if (!condition) {
        throw new SystemError(userMsg, msg, code);
    }
}


function assertUser(
    condition,
    userMsg,
    code,
    msg,
) {
    if (!condition) {
        throw new UserError(userMsg, msg, code);
    }
}
