const config = require('config');
const Asana = require('asana');
const asana = Asana.Client.create().useAccessToken(config.asana.accessToken);
const { WebClient } = require('@slack/client');
const slack = new WebClient(config.slack.botUserAccessToken);
const jsonfile = require('jsonfile');

console.log('Fetching Asana user list...');
asana.users.findAll(config.asana.targetProjectId)
  .then(res => {
    let directory = {};
    for (const {id, name} of res.data) {
      directory[name] = {asanaId: id};
    }
    return directory;
  })
  .then(directory => {
    console.log('Fetching Slack user list...');
    slack.users.list()
      .then(res => {
        for (const {id, name, real_name} of res.members) {
          if (directory[real_name]) {
            directory[real_name].slackId = id;
          } else if (directory[name]) {
            directory[name].slackId = id;
          } else {
            directory[real_name] = {slackId: id};
          }
        }

        let found = [], error = [];
        for (const name in directory) {
          const obj = {
              name,
              asana: directory[name].asanaId,
              slack: directory[name].slackId,
          };
          if (directory[name].asanaId && directory[name].slackId) {
            found.push(obj);
          } else {
            error.push(obj);
          }
        }

        console.log(`Built directory (found: ${found.length}, error: ${error.length}).`);

        console.log('Saving to directory.json...');
        jsonfile.writeFileSync('directory.json', {
          directory: found,
          error,
        }, {spaces: 2});
      });
  });
