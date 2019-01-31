Array.prototype.flatten = function() {
  return Array.prototype.concat.apply([], this);
};

(async _ => {
  const inquirer = require('inquirer');
  const jsonfile = require('jsonfile');

  const mappings = jsonfile.readFileSync('mappings.json', {throws: false});

  if (!mappings) {
    console.error('mappings.json not found');

    return;
  }

  const { asana } = await inquirer.prompt({
    type: 'list',
    name: 'asana',
    message: 'Which Asana channel?',
    choices: mappings.hint.channels.asana
      .map(
        ({ name: team, projects }) => projects
          .map(({ id, name }) => ({ value: id, name: team + ' > ' + name }))
      )
      .flatten(),
  });

  const { slack } = await inquirer.prompt({
    type: 'list',
    name: 'slack',
    message: 'Which Slack channel?',
    choices: mappings.hint.channels.slack
      .map(({ id: value, name }) => ({ value, name })),
  });

  const { name } = mappings.hint.channels.slack
        .filter(({ id }) => id === slack)[0];

  const { ok } = await inquirer.prompt({
    type: 'confirm',
    name: 'ok',
    message: `Map ${asana} with ${name}?`,
  });

  if (ok) {
    mappings.channels.push({ asana, slack, name });
    mappings.hint.channels.asana
      .forEach(team => {
        team.projects = team.projects.filter(({ id }) => id !== asana);
      });
    mappings.hint.channels.slack = mappings.hint.channels.slack
      .filter(({ id }) => id !== slack);

    jsonfile.writeFileSync('mappings.json', mappings, {spaces: 2});
  }
})();
