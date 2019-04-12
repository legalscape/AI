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
      if (type !== 'task' || action === 'deleted') {
        continue;
      }

      asana.tasks.findById(resource)
        .then(task => {
          const isInUniverse = task.projects.some(p => p.id == project);

          if (task.parent) {
            return;
          }

          if (task.completed && isInUniverse) {
            asana.tasks.removeProject(task.id, { project })
              .catch(error => console.log(error.value.errors));
          } else if (!task.completed && !isInUniverse) {
            asana.tasks.addProject(task.id, { project })
              .catch(error => console.log(error.value.errors));
          }
        })
        .catch(error => console.log(type, action, error.value.errors));
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
    const projects = await asana.projects.findByTeam(team.id, {archived: false});

    projects.data.forEach((project, i) => {
      setTimeout(async () => {
        await asana.webhooks.create(project.id, config.asana.webhook.url)
          .then(res => console.log(`[${i + 1} / ${projects.data.length}]`,
                                   `Webhook set on ${res.resource.name} (${res.resource.id})`))
          .catch(error => console.log(`[${i + 1} / ${projects.data.length}]`,
                                      project.name, error.value.errors));
      }, i * 100);
    });
  }
});
