const config = require('config');
const dateism = require('dateism');
const Asana = require('asana');
const asana = Asana.Client.create({defaultHeaders: {'asana-enable': 'string_ids'}}).useAccessToken(config.asana.accessToken);
const { getUsers } = require('./utility');
const { WebClient } = require('@slack/client');
const slack = new WebClient(config.slack.botUserAccessToken);

(async () => {
    const today = dateism('YYYY-MM-DD').today();
    const channel = config.slack.announcementChannelId;
    const text = 'Asanaに登録されている今日中に期限切れになるタスクの件数\n' +
        (await Promise.all(getUsers().map(async user => ({
            user,
            tasks: await asana.tasks.searchInWorkspace(config.asana.organizationId, {
                'assignee.any': user.asana,
                'completed': false,
                'due_on.before': today,
            }),
        }))))
            .filter(({ tasks }) => tasks.data.length > 0)
            .sort((a, b) => b.tasks.data.length - a.tasks.data.length)
            .map(({ user, tasks }) => `<@${user.slack}>: ${tasks.data.length} 件\n　${tasks.data.map(task => '<https://app.asana.com/0/0/' + task.gid + '|' + task.name + '>').join(', ')}`)
            .join('\n') + '\n適切な期限を再設定しましょう！';

    await slack.chat.postMessage({ channel, text });
})();
