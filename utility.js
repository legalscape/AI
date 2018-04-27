const jsonfile = require('jsonfile');

const directory = jsonfile.readFileSync('directory.json').directory;
const getSlackMentionByAsanaId = ({id, name}) => {
  for (const {asana, slack} of directory) {
    if (asana === id) {
      return `<@${slack}>`;
    }
  }

  return name;
};

const getAsanaIdBySlackId = id => {
  if (id.match(/^<@.+>$/)) {
    id = id.slice(2, -1);
  }

  for (const {asana, slack} of directory) {
    if (slack === id) {
      return asana;
    }
  }

  return null;
};

const getName = id => {
  for (const {name, asana, slack} of directory) {
    if (asana === id || slack === id) {
      return name;
    }
  }

  return null;
};

module.exports = {
  getSlackMentionByAsanaId,
  getAsanaIdBySlackId,
  getName,
};
