const config = require('config');
const Asana = require('asana');

const express = require('express');
const bodyParser = require('body-parser');

const asana = Asana.Client.create().useAccessToken(config.asana.accessToken);

const { WebClient } = require('@slack/client');
const slack = new WebClient(config.slack.botUserAccessToken);

const app = express();

app.use(bodyParser.json());

app.post('/asana', async (req, res) => {
  const project = config.asana.universalProjectId;

  if (req.body.events) {
    for (const { resource, type, action } of req.body.events) {
      if ((type || resource.resource_type) !== 'task' || action === 'deleted') {
        continue;
      }

      asana.tasks.findById(resource.gid)
        .then(task => {
          const isInUniverse = task.projects.some(p => p.gid == project);

          if (task.parent || task.resource_subtype === 'section' || task.resource_subtype === 'milestone') {
            return;
          }

          if (task.completed && isInUniverse) {
            asana.tasks.removeProject(task.gid, { project })
              .catch(error => console.log(error.value || error));
          } else if (!task.completed && !isInUniverse) {
            asana.tasks.addProject(task.gid, { project })
              .catch(error => console.log(error.value || error));
          }
        })
        .catch(error => console.log((type || resource.resource_type), action, error.value || error));
    }
  }

  res.set('X-Hook-Secret', req.get('X-Hook-Secret'));
  res.send('ok');
});

app.post(`/ai-says/${config.ai.says.secret}`, (req, res) => {
  const { channel, text } = req.body;
  slack.chat.postMessage({ channel, text })
    .then(data => res.send(data))
    .catch(({ data }) => res.send(data));
});

app.listen(config.asana.webhook.port, async () => {
  console.log(`Listening on port ${config.asana.webhook.port}.`);

  if (process.argv.indexOf('--setup') > -1) {
    const { team } = await asana.projects.findById(config.asana.universalProjectId);
    const projects = await asana.projects.findByTeam(team.gid, { archived: false });

    projects.data.forEach((project, i) => {
      setTimeout(async () => {
        await asana.webhooks.create(project.gid, config.asana.webhook.url)
          .then(res => console.log(`[${i + 1} / ${projects.data.length}]`,
            `Webhook set on ${res.resource.name} (${res.resource.gid})`))
          .catch(error => console.log(`[${i + 1} / ${projects.data.length}]`,
            project.name, error.value || error));
      }, i * 100);
    });
  }
});
