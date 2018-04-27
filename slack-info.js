const config = require('config');
const { WebClient } = require('@slack/client');
const slack = new WebClient(config.slack.botUserAccessToken);
const { getName } = require('./utility');

slack.im.list().then(res => {
  for (const {id, user} of res.ims) {
    console.log(`${getName(user) || '?????'} (User ID ${user}) => Channel ID ${id}`);
  }
});
