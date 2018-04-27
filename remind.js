const config = require('config');
const Asana = require('asana');
const asana = Asana.Client.create().useAccessToken(config.asana.accessToken);
const { WebClient } = require('@slack/client');
const slack = new WebClient(config.slack.botUserAccessToken);
const { getSlackMentionByAsanaId } = require('./utility');

asana.tasks.findByProject(config.asana.targetProjectId, {
  completed_since: 'now',
  opt_fields: 'id,name,assignee.id,assignee.name'
}).then(res => {
  let text = '今日やれ\n';
  for (const {id, assignee, name} of res.data) {
    text += `:ballot_box_with_check: <https://app.asana.com/0/${config.asana.targetProjectId}/${id}|${name}>`;
    if (assignee) {
      text += ` (${getSlackMentionByAsanaId(assignee)})`;
    }
    text += '\n';
  }

  for (const channel of config.slack.announcementChannelIds) {
    slack.chat.postMessage({
      channel: channel,
      text
    });
  }
});
