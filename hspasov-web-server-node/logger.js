const errorLogLevels = {
  ERROR: 1,
  INFO: 2,
  WARNING: 3,
  DEBUG: 4,
};

const error = (level, fields) => {
  // TODO assert types
  console.error(fields.msg);
};

const access = () => {

};

module.exports = {
  log: {
    error,
    access,
  },
  errorLogLevels,
};
