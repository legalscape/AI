// Commands:
//   hubot todo 牛乳を買う - Asanaの適切なチャンネルにタスクを追加
//   hubot todo 明日 牛乳を買う - Asanaの適切なチャンネルにタスクを追加
//   hubot todo 牛乳を買う 2018-04-01 @john - Asanaの適切なチャンネルにタスクを追加

const config = require('config');
const Asana = require('asana');
const asana = Asana.Client.create().useAccessToken(config.asana.accessToken);
const dateism = require('dateism');
const { WebClient } = require('@slack/client');
const slack = new WebClient(process.env.HUBOT_SLACK_TOKEN);
const { getAsanaIdBySlackId, getAsanaProjectIdBySlackChannelId } = require('../utility');

module.exports = robot => {
  robot.hear(/(?:^| )todo\s.+/i, async res => {
    const now = dateism('YYYY-MM-DD', new Date(res.message.id * 1000));
    const query = res.message.rawText
          .split(/(?:^| )todo\s+/i)[1]
          .trim()
          .split(/\s+|(<@\S+>)/)
          .filter(x => x);

    let name = [];
    const assignedBy = getAsanaIdBySlackId(res.message.user.id);
    let assignedTo = assignedBy;
    let due = now.today();
    for (const q of query) {
      if (q.match(/^<@\S+>$/)) {
        assignedTo = getAsanaIdBySlackId(q);
      } else if (['tomorrow', '明日', 'あす', 'あした'].indexOf(q) >= 0) {
        due = now.tomorrow();
      } else if (['明後日', 'あさって'].indexOf(q) >= 0) {
        due = now.addDays(2);
      } else if (q === '来週') {
        due = now.addDays(7);
      } else if (q.match(/\d{4}-\d{2}-\d{2}/)) {
        due = q;
      } else {
        name.push(q);
      }
    }

    if (res.message.rawMessage.channel.charAt(0) === 'D') {
      // DM
      asana.tasks.create({
        name: name.join(' '),
        followers: [assignedBy, assignedTo],
        assignee: assignedTo,
        due_on: due,
        workspace: config.asana.organizationId,
      }).then(_ => slack.reactions.add({
        name: 'secret',
        channel: res.message.room,
        timestamp: res.message.id,
      })).catch(console.error);
    } else {
      const project = getAsanaProjectIdBySlackChannelId(res.message.room);

      if (!project) {
        res.reply("Well, actually I don't know the project to add that.");
        return;
      }

      asana.tasks.create({
        name: name.join(' '),
        followers: [assignedBy, assignedTo],
        assignee: assignedTo,
        projects: [project, config.asana.universalProjectId],
        due_on: due,
      }).then(_ => slack.reactions.add({
        name: 'thumbsup',
        channel: res.message.room,
        timestamp: res.message.id,
      })).catch(console.error);
    }
  });
};
