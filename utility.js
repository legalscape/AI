const jsonfile = require('jsonfile');

const mappings = jsonfile.readFileSync('mappings.json');
const getSlackMentionByAsanaId = ({id, name}) => {
  for (const {asana, slack} of mappings.users) {
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

  for (const {asana, slack} of mappings.users) {
    if (slack === id) {
      return asana;
    }
  }

  return null;
};

const getName = id => {
  for (const {name, asana, slack} of mappings.users) {
    if (asana === id || slack === id) {
      return name;
    }
  }

  return null;
};

const getAsanaProjectIdBySlackChannelId = id => {
  for (const {asana, slack} of mappings.channels) {
    if (slack === id) {
      return asana;
    }
  }

  return null;
};

module.exports = {
  getSlackMentionByAsanaId,
  getAsanaIdBySlackId,
  getName,
  getAsanaProjectIdBySlackChannelId,
};
