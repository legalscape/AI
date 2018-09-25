const config = require('config');
const Asana = require('asana');

const express = require('express');
const bodyParser = require('body-parser');

const asana = Asana.Client.create().useAccessToken(config.asana.accessToken);
const app = express();

app.use(bodyParser.json());

app.post('/asana', async (req, res) => {
  const project = config.asana.universalProjectId;

  if (req.body.events) {
    for (const { resource, type } of req.body.events) {
      if (type !== 'task') {
        continue;
      }

      const task = await asana.tasks.findById(resource);
      const isInUniverse = task.projects.some(p => p.id == project);

      if (task.completed && isInUniverse) {
        asana.tasks.removeProject(task.id, { project })
          .catch(error => console.log(error.value.errors));
      } else if (!task.completed && !isInUniverse) {
        asana.tasks.addProject(task.id, { project })
          .catch(error => console.log(error.value.errors));
      }
    }
  }

  res.set('X-Hook-Secret', req.get('X-Hook-Secret'));
  res.send('ok');
});

app.listen(config.asana.webhook.port, async () => {
  console.log(`Listening on port ${config.asana.webhook.port}.`);

  if (process.argv.indexOf('--setup') > -1) {
    const { team } = await asana.projects.findById(config.asana.universalProjectId);
    const projects = await asana.projects.findByTeam(team.id, {archived: false});

    projects.data.forEach(async project => {
      await asana.webhooks.create(project.id, config.asana.webhook.url)
        .then(res => console.log(`Webhook set on ${res.resource.name} (${res.resource.id})`))
        .catch(error => console.log(project.name, error.value.errors));
    });
  }
});
