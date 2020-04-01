const config = require('config');
const dateism = require('dateism');
const Asana = require('asana');
const asana = Asana.Client.create({ defaultHeaders: { 'asana-enable': 'string_ids' } }).useAccessToken(
    config.asana.accessToken
);
const { getUsers } = require('./utility');
const { WebClient } = require('@slack/client');
const slack = new WebClient(config.slack.botUserAccessToken);

const endOfToday = new Date();
endOfToday.setHours(0, 0, 0, 0);
const countDays = (task) => {
    return ((endOfToday.getTime()) - (new Date(task.due_at || task.due_on).getTime())) / 1000 / 60 / 60 / 24;
}

(async () => {
    const today = dateism('YYYY-MM-DD').today();
    const channel = config.slack.announcementChannelId;
    const usersAndTasks = (
        await Promise.all(
            getUsers().map(async user => ({
                user,
                tasks: await asana.tasks
                    .searchInWorkspace(config.asana.organizationId, {
                        'assignee.any': user.asana,
                        completed: false,
                        'due_on.before': today,
                    })
                    .catch(e => console.log(e.value)),
            }))
        )
    )
        .filter(({ tasks }) => tasks.data.length > 0)
        .sort((a, b) => b.tasks.data.length - a.tasks.data.length);
    const text =
        'Asanaに登録されている今日中に期限切れになるタスクの件数\n' +
        (
            await Promise.all(
                usersAndTasks.map(
                    async ({ user, tasks }) =>
                        `<@${user.slack}>: ${tasks.data.length} 件\n` +
                        (
                            await Promise.all(
                                tasks.data.map(
                                    async task =>
                                        '　<https://app.asana.com/0/0/' +
                                        task.gid +
                                        '|' +
                                        task.name +
                                        '>（' +
                                        countDays(await asana.tasks.findById(task.gid)) +
                                        '日放置している）'
                                )
                            )
                        ).join('\n')
                )
            )
        ).join('\n') +
        '\n適切な期限を再設定しましょう！';

    await slack.chat.postMessage({ channel, text });
})();
