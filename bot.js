const config = require('config');
const Asana = require('asana');
const asana = Asana.Client.create().useAccessToken(config.asana.accessToken);
const { createSlackEventAdapter } = require('@slack/events-api');
const slackEvents = createSlackEventAdapter(config.slack.verificationToken);
const { WebClient } = require('@slack/client');
const slack = new WebClient(config.slack.botUserAccessToken);
const { getAsanaIdBySlackId } = require('./utility');

const listener = event => {
  if (event.subtype === 'bot_message') {
    return;
  }

  const match = event.text.match(
    event.type === 'message' ?
      /^\s*今日\s+(.+?)\s*(<@[A-Z0-9]+>)?\s*$/ :
      /^\s*<@[A-Z0-9]+>\s+今日\s+(.+?)\s*(<@[A-Z0-9]+>)?\s*$/
  );
  if (match) {
    const assigner = getAsanaIdBySlackId(event.user);
    const assignee = (match[2] && getAsanaIdBySlackId(match[2])) || assigner;
    asana.tasks.create({
      name: match[1],
      followers: [assigner, assignee],
      assignee: assignee,
      projects: [config.asana.targetProjectId],
      due_at: new Date().toISOString(),
    })
      .then(_ => slack.reactions.add({
        name: 'thumbsup',
        channel: event.channel,
        timestamp: event.ts,
      }))
      .catch(err => slack.chat.postMessage({
        channel: event.channel,
        text: 'Error: ' + JSON.stringify(err),
      }));
  } else {
    slack.reactions.add({
      name: 'question',
      channel: event.channel,
      timestamp: event.ts,
    });
  }
};

slackEvents.on('message', listener);
slackEvents.on('app_mention', listener);
slackEvents.on('error', console.error);
slackEvents.start(config.slack.port).then(() => {
  console.log(`server listening on port ${config.slack.port}`);
});
