const config = require('config');
const dateism = require('dateism');
const Asana = require('asana');
const asana = Asana.Client.create().useAccessToken(config.asana.accessToken);
const { getUsers } = require('./utility');
const { WebClient } = require('@slack/client');
const slack = new WebClient(config.slack.botUserAccessToken);

(async () => {
    const today = dateism('YYYY-MM-DD').today();
    const channel = config.slack.announcementChannelId;
    const text = 'These people has nothing on their outdated task list :sparkles: Super :sunglasses:\n' +
        (await Promise.all(getUsers().map(async user => ({
            user,
            tasks: await asana.tasks.searchInWorkspace(config.asana.organizationId, {
                'assignee.any': user.asana,
                'completed': false,
                'due_on.before': today,
            }),
        }))))
            .filter(({ tasks }) => tasks.data.length === 0)
            .map(({ user }) => `<@${user.slack}>`)
            .join(' ') + '\nAll others have some tasks behind schedule... :sad:';

    await slack.chat.postMessage({ channel, text });
})();
