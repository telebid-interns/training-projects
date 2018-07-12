const fs = require('fs');
const path = require('path');
const {assertApp} = require('./asserts');

const UPLOADS_DIR = path.join(__dirname, '/uploads');

// TODO ask ivan
const database = (() => {
  if (!fs.existsSync('db.json')) {
    fs.writeFileSync('db.json', '{}');
  }

  const save = () => {
    console.log('Saving database contents to: ', storage.data);
    fs.writeFileSync('db.json', JSON.stringify(storage.data));
  };
  const read = () => {
    // TODO error handling
    storage.data = JSON.parse(fs.readFileSync('db.json', 'utf-8'));
  };

  // TODO can be const
  let storage = {
    read,
    save,
    data: undefined // TODO remove or change to null
  };

  storage.read();
  return storage;
})();

function getRecord (name) {
  return database.data[name];
}

function exists (name) {
  return !!database.data[name];
}

// TODO maybe rename to register
function add ({
  name
}) {
  assertApp(!exists(name), `Name ${name} already exists. Cannot create it.`);
  database.data[name] = {
    name: name,
    files: {}
  };
  fs.mkdirSync(path.join(UPLOADS_DIR, name));
  database.save();
  console.log('created name', name, 'database is: ', database);
}

function upload (name, file) {
  let record = database.data[name];

  if (!record) {
    console.log('Name %s does not exist. Creating...', name);
    add({name});
    record = database.data[name];
  }

  let uploadDst;
  const existingFile = record.files[file.name];

  if (existingFile) {
    uploadDst = existingFile.path;
    console.log('Uploaded file already exists. Overwriting: ', uploadDst);
  } else {
    uploadDst = path.join(UPLOADS_DIR, name, file.name);
  }

  handleUploadStream(file.path, uploadDst, true);
  record.files[file.name] = {
    name: file.name,
    path: file.path
  };
  console.log('Successfully uploaded file %r to record %r', file, record);
  console.log('current record state is: ', record);
  database.save();
}

function handleUploadStream (fileStreamPath, uploadDestination, overwrite = false) {
  // TODO put in assert
  if (!overwrite) {
    assertApp(
      !fs.existsSync(uploadDestination),
      `uploadDst ${uploadDestination} exists but overwrite flag is false`
    );
  }

  const reader = fs.createReadStream(fileStreamPath);
  const stream = fs.createWriteStream(path.join(uploadDestination));

  reader.pipe(stream);
  console.log('uploading %s -> %s', fileStreamPath, uploadDestination);
}

module.exports = {
  add,
  upload,
  getRecord,
  exists
};
