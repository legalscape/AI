const config = require('config');
const Asana = require('asana');
const asana = Asana.Client.create().useAccessToken(config.asana.accessToken);
const { WebClient } = require('@slack/client');
const slack = new WebClient(config.slack.botUserAccessToken);
const jsonfile = require('jsonfile');

const myFilter = isPrivate => function({id, name}) {
  return {id, name, isPrivate};
};

(async _ => {
  console.log('Fetching Asana user list...');
  let users = {};
  for (const {id, name} of (await asana.users.findByWorkspace(config.asana.organizationId)).data) {
    users[name] = {asanaId: id};
  }

  console.log('Fetching Slack user list...');
  for (const {id, name, real_name} of (await slack.users.list()).members) {
    if (users[real_name]) {
      users[real_name].slackId = id;
    } else if (users[name]) {
      users[name].slackId = id;
    } else {
      users[real_name] = {slackId: id};
    }
  }

  let found = [], error = [];
  for (const name in users) {
    const obj = {
      name,
      asana: users[name].asanaId,
      slack: users[name].slackId,
    };
    if (users[name].asanaId && users[name].slackId) {
      found.push(obj);
    } else {
      error.push(obj);
    }
  }

  console.log(`Built user mapping (found: ${found.length}, error: ${error.length}).`);

  console.log('Fetching Asana projects list...');
  let teams = (await asana.teams.findByOrganization(config.asana.organizationId)).data;
  for (let i = 0; i < teams.length; ++i) {
    teams[i].projects = (await asana.projects.findByTeam(teams[i].id, {archived: false})).data;
  }

  console.log('Fetching Slack channel list...');
  const res1 = await slack.channels.list({
    exclude_archived: true,
    limit: 100,
  });
  if (res1.response_metadata.next_cursor) {
    throw new Exception('not implemented');
  }
  const res2 = await slack.groups.list({
    exclude_archived: true,
  });

  console.log('Saving to mappings.json...');
  jsonfile.writeFileSync('mappings.json', {
    users: found,
    channels: [
      {
        name: 'example',
        asana: 1234567890,
        slack: 'AAAAAAAAA',
      },
    ],
    hint: {
      users: error,
      channels: {
        asana: teams,
        slack: res1.channels.map(myFilter(false))
          .concat(res2.groups.map(myFilter(true)))
          .sort((x, y) => x.name > y.name),
      }
    }
  }, {spaces: 2});
})();
