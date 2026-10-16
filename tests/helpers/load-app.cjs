const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '../..');

function applicationScripts() {
  const html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
  return [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g)]
    .map(match => match[1])
    .filter(source => !/^https?:\/\//.test(source));
}

// Keep the existing behavior tests readable while production exposes only Vocab.
// Getters/setters ensure test overrides reach the same namespace used by features.
function exposeTestAliases(context) {
  const app = context.Vocab;
  const alias = (name, object, property) => Object.defineProperty(context, name, {
    configurable: true,
    get: () => object[property],
    set: value => { object[property] = value; }
  });
  alias('S', app.store, 'data');
  alias('KEY', app.config, 'STORAGE_KEY');
  alias('DAY', app.config, 'DAY');
  alias('INTERVAL', app.config, 'LEITNER_INTERVALS');
  for (const group of ['utils', 'store', 'importer', 'decks', 'study',
    'navigation', 'matching', 'quiz', 'sentence', 'daily', 'audio']) {
    for (const property of Object.keys(app[group])) {
      if (property !== 'data') alias(property, app[group], property);
    }
  }
  const study = app.session.study, play = app.session.play;
  for (const [name, property] of Object.entries({
    scope: 'scope', forceAll: 'forceAll', queue: 'queue',
    flipped: 'flipped', studyIndex: 'index', studyDaily: 'daily'
  })) alias(name, study, property);
  for (const [name, property] of Object.entries({
    playScope: 'scope', playMode: 'mode', playDaily: 'daily'
  })) alias(name, play, property);
  for (const [name, property] of Object.entries({
    matchPick: 'pick', matchCards: 'cards', matchTimer: 'timer', matchSeen: 'seen'
  })) alias(name, play.match, property);
  for (const [name, property] of Object.entries({
    quizList: 'list', quizStep: 'step', quizTimer: 'timer', quizLocked: 'locked'
  })) alias(name, play.quiz, property);
}

function loadApplication(context, beforeStart, { aliases = true } = {}) {
  for (const source of applicationScripts()) {
    if (source === 'src/js/bootstrap.js') {
      if (aliases) exposeTestAliases(context);
      if (beforeStart) beforeStart(context.Vocab);
    }
    vm.runInContext(fs.readFileSync(path.join(projectRoot, source), 'utf8'), context, {
      filename: source
    });
  }
  return context.Vocab;
}

module.exports = { loadApplication, applicationScripts, projectRoot };
