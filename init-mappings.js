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
  const existing = jsonfile.readFileSync('mappings.json', {throws: false});

  if (existing) {
    console.log('mappings.json already exists and the existing mappings recorded in it will be kept.');
  }

  console.log('Fetching Asana user list...');
  let users = {};
  const knownAsanaUsers = existing ? existing.users.map(o => o.asana) : [];
  for (const {id, name} of (await asana.users.findByWorkspace(config.asana.organizationId)).data) {
    if (knownAsanaUsers.indexOf(id) < 0) {
      users[name] = {asanaId: id};
    }
  }

  console.log('Fetching Slack user list...');
  const knownSlackUsers = existing ? existing.users.map(o => o.slack) : [];
  for (const {id, name, real_name} of (await slack.users.list()).members) {
    if (knownSlackUsers.indexOf(id) < 0) {
      if (users[real_name]) {
        users[real_name].slackId = id;
      } else if (users[name]) {
        users[name].slackId = id;
      } else {
        users[real_name] = {slackId: id};
      }
    }
  }

  let found = existing ? existing.users : [], error = [];
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

  if (existing) {
    console.log(`Built user mapping (existing: ${existing.users.length}, newly found: ${found.length - existing.users.length}, error: ${error.length}).`);
  } else {
    console.log(`Built user mapping (found: ${found.length}, error: ${error.length}).`);
  }

  console.log('Fetching Asana projects list...');
  const knownAsanaProjects = existing ? existing.channels.map(o => o.asana) : [];
  let asanaTeams = (await asana.teams.findByOrganization(config.asana.organizationId)).data;
  for (let i = 0; i < asanaTeams.length; ++i) {
    asanaTeams[i].projects =
      (await asana.projects.findByTeam(asanaTeams[i].id, {archived: false}))
      .data
      .filter(p => knownAsanaProjects.indexOf(p.id) < 0);
  }

  console.log('Fetching Slack channel list...');
  const knownSlackChannels = existing ? existing.channels.map(o => o.slack) : [];
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

  const slackChannels = res1.channels.map(myFilter(false))
        .concat(res2.groups.map(myFilter(true)))
        .filter(c => knownSlackChannels.indexOf(c.id) < 0)
        .sort((x, y) => x.name.localeCompare(y.name));

  console.log('Saving to mappings.json...');
  jsonfile.writeFileSync('mappings.json', {
    users: found,
    channels: existing ? existing.channels : [
      {
        name: 'example',
        asana: 1234567890,
        slack: 'AAAAAAAAA',
      },
    ],
    hint: {
      users: error,
      channels: {
        asana: asanaTeams,
        slack: slackChannels,
      }
    }
  }, {spaces: 2});

  console.log('Now please edit mappings.json manually or npm run update-mappings.');
})();
