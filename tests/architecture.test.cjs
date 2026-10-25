const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { loadApplication, applicationScripts, projectRoot } = require('./helpers/load-app.cjs');

// A small DOM fixture for startup and wiring, separate from the game-specific fixtures.
function browser(initial) {
  class Element {
    constructor(tag = 'div') {
      this.tag = tag;
      this.children = [];
      this.dataset = {};
      this.classes = new Set();
      this.hidden = false;
      this.value = '';
      this.textContent = '';
    }
    set innerHTML(value) {
      this.children = [];
      if (value.startsWith('<div><b></b><small>')) {
        const heading = new Element(), actions = new Element();
        heading.append(new Element('b'), new Element('small'));
        this.append(heading, actions);
      }
    }
    set className(value) { this.classes = new Set(value.split(' ')); }
    get lastChild() { return this.children.at(-1); }
    get classList() {
      return {
        add: (...names) => names.forEach(name => this.classes.add(name)),
        remove: (...names) => names.forEach(name => this.classes.delete(name)),
        toggle: (name, enabled) => enabled ? this.classes.add(name) : this.classes.delete(name)
      };
    }
    append(...children) { this.children.push(...children); }
    querySelector(tag) {
      for (const child of this.children) {
        if (child.tag === tag) return child;
        const nested = child.querySelector(tag);
        if (nested) return nested;
      }
      return null;
    }
    setAttribute(name, value) { this[name] = value; }
    showModal() { this.open = true; }
    close() { this.open = false; }
  }
  const html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
  const elements = new Map();
  for (const match of html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)) {
    const element = new Element();
    element.hidden = /\shidden(?:\s|>)/.test(match[0]);
    elements.set(match[1], element);
  }
  let saved = initial ? JSON.stringify(initial) : null;
  const listeners = { window: [], document: [], intervals: [] };
  const context = vm.createContext({
    document: {
      getElementById: id => elements.get(id) || null,
      createElement: tag => new Element(tag),
      addEventListener: (...args) => listeners.document.push(args)
    },
    window: { addEventListener: (...args) => listeners.window.push(args) },
    localStorage: {
      getItem(key) { assert.equal(key, 'flashcards_v1'); return saved; },
      setItem(key, value) { assert.equal(key, 'flashcards_v1'); saved = value; }
    },
    setTimeout: () => 1,
    clearTimeout: () => {},
    setInterval: (...args) => listeners.intervals.push(args),
    confirm: () => true,
    alert: () => {},
    Date, Intl, Math
  });
  const globalsBefore = Object.keys(context);
  const app = loadApplication(context, undefined, { aliases: false });
  return {
    app, context, elements, listeners,
    saved: () => JSON.parse(saved),
    addedGlobals: Object.keys(context).filter(key => !globalsBefore.includes(key))
  };
}

test('HTML loads every application script once, with bootstrap last and file:// compatibility', () => {
  const scripts = applicationScripts();
  assert.equal(new Set(scripts).size, scripts.length);
  assert.equal(scripts.at(-1), 'src/js/bootstrap.js');
  function jsFiles(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
      const target = path.join(directory, entry.name);
      return entry.isDirectory() ? jsFiles(target) : target.endsWith('.js') ? [target] : [];
    });
  }
  assert.deepEqual(
    scripts.map(source => path.resolve(projectRoot, source)).sort(),
    jsFiles(path.join(projectRoot, 'src/js')).sort()
  );
  const html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /<script[^>]+(?:type="module"|\sasync\b)/);
});

test('stylesheet entry resolves all imports with responsive overrides last', () => {
  const html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
  const stylesheet = html.match(/<link[^>]+href="([^"]+)"/)[1];
  const entry = path.resolve(projectRoot, stylesheet);
  const css = fs.readFileSync(entry, 'utf8');
  const imports = [...css.matchAll(/@import url\("([^"]+)"\);/g)].map(match => match[1]);
  assert.equal(imports.at(-1), './responsive.css');
  for (const source of imports) {
    assert.ok(fs.readFileSync(path.resolve(path.dirname(entry), source), 'utf8').trim());
  }
});

test('real startup binds controls and lifecycle once and exposes only one application global', () => {
  const b = browser();
  assert.deepEqual(b.addedGlobals, ['Vocab']);
  assert.equal(b.elements.get('programStart').disabled, true);
  assert.equal(b.elements.get('study').hidden, true);
  assert.equal(b.elements.get('play').hidden, true);
  for (const id of ['addDeck', 'card', 'prevCard', 'nextCard', 'rate', 'all',
    'back', 'playBack', 'gameAgain', 'spkW', 'spkS', 'programStart', 'programStudy', 'dailyReturn',
    'editCard', 'wordCancel', 'wordDelete', 'backupExport', 'backupImport']) {
    assert.equal(typeof b.elements.get(id).onclick, 'function', id);
  }
  assert.equal(typeof b.elements.get('file').onchange, 'function');
  assert.equal(typeof b.elements.get('backupFile').onchange, 'function');
  assert.equal(typeof b.elements.get('wordForm').onsubmit, 'function');
  assert.deepEqual(b.listeners.window.map(listener => listener[0]).sort(), ['focus', 'pagehide']);
  assert.deepEqual(b.listeners.document.map(listener => listener[0]).sort(), ['keydown', 'visibilitychange']);
  assert.equal(b.listeners.intervals.length, 1);
  assert.equal(b.listeners.intervals[0][1], 1000);
});

test('legacy saved state resumes the current card and category controls reach their feature modules', () => {
  const initial = {
    decks: { Test: [{ id: 'old-card', en: 'learn', tr: 'ogrenmek', ex: 'We learn daily.', box: 2, due: 0 }] },
    pts: 42, streak: 3, last: '', today: 0, cur: 'old-card', customField: 'preserve me'
  };
  const b = browser(initial);
  assert.equal(b.elements.get('en').textContent, 'learn');
  assert.equal(b.elements.get('home').hidden, true);
  assert.equal(b.elements.get('study').hidden, false);
  assert.equal(b.app.session.study.scope, 'Test');
  assert.equal(b.saved().customField, 'preserve me');
  assert.equal(b.saved().pts, 42);
  b.elements.get('back').onclick();
  for (const [label, mode] of [['Eşleştir', 'match'], ['Soru-Cevap', 'quiz'], ['Cümle Tamamla', 'sentence']]) {
    const actions = b.elements.get('decks').children[0].lastChild.children;
    actions.find(button => button.textContent === label).onclick();
    assert.equal(b.app.session.play.mode, mode);
    assert.equal(b.app.session.play.scope, 'Test');
    b.elements.get('playBack').onclick();
  }
  b.elements.get('newDeck').value = '  Other  ';
  b.elements.get('addDeck').onclick();
  assert.ok(b.saved().decks.Other);
  assert.equal(b.elements.get('newDeck').value, '');
  assert.equal(b.elements.get('decks').children.length, 3);
});

const key = (b, value, tagName = 'BODY') => b.app.shortcuts.handleKey({ key: value, target: { tagName }, preventDefault() {} });

test('hard words form a virtual category that can be studied with keyboard shortcuts', () => {
  const b = browser({
    decks: { Test: [
      { id: 'a', en: 'abate', tr: 'azalmak', box: 1, due: 0, quizDifficulty: 4 },
      { id: 'b', en: 'bolster', tr: 'desteklemek', box: 1, due: 0, cardDifficulty: 2 },
      { id: 'c', en: 'curb', tr: 'dizginlemek', box: 1, due: Date.now() + 1e9 }
    ] }, pts: 0, streak: 0, last: '', today: 0, cur: null
  });
  const hardDeck = b.elements.get('decks').children[0];
  assert.equal(hardDeck.querySelector('b').textContent, 'Zor kelimelerim');
  hardDeck.children[1].children.find(button => button.textContent === 'Çalış').onclick();
  assert.equal(b.app.session.study.scope, b.app.config.HARD_SCOPE);
  assert.equal(b.app.session.study.queue.map(card => card.id).join(), 'a,b');
  assert.equal(key(b, '3'), false, 'rating waits until the card is flipped');
  assert.equal(key(b, ' '), true);
  assert.equal(b.elements.get('rate').hidden, false);
  assert.equal(key(b, '3'), true);
  assert.equal(b.saved().decks.Test[0].cardDifficulty, 0);
  assert.equal(b.saved().pts, 10);
  assert.equal(key(b, ' ', 'INPUT'), false, 'typing is never intercepted');
});

test('quiz choices can be answered with number keys', () => {
  const b = browser({
    decks: { Test: [
      { id: 'a', en: 'abate', tr: 'azalmak', box: 1, due: 0 },
      { id: 'b', en: 'bolster', tr: 'desteklemek', box: 1, due: 0 }
    ] }, pts: 0, streak: 0, last: '', today: 0, cur: null
  });
  b.app.quiz.startQuiz('Test');
  assert.equal(key(b, '1'), true);
  assert.equal(b.app.session.play.quiz.locked, true);
  assert.equal(key(b, '9'), false);
});

test('word editor saves fields, rejects duplicates and deletes a word everywhere', () => {
  const b = browser({
    decks: { Test: [
      { id: 'a', en: 'abate', tr: 'yanlis', box: 1, due: 0 },
      { id: 'b', en: 'bolster', tr: 'desteklemek', box: 1, due: 0 }
    ] }, pts: 0, streak: 0, last: '', today: 0, cur: null
  });
  b.app.daily.beginDaily();
  b.app.study.startStudy('Test');
  b.elements.get('editCard').onclick();
  assert.equal(b.elements.get('wordEditor').open, true);
  assert.equal(b.elements.get('editEn').value, 'abate');
  b.elements.get('editTr').value = ' azalmak ';
  b.elements.get('wordForm').onsubmit({ preventDefault() {} });
  assert.equal(b.saved().decks.Test[0].tr, 'azalmak');
  assert.equal(b.elements.get('wordEditor').open, false);
  b.app.words.openEditor();
  b.elements.get('editEn').value = 'BOLSTER';
  assert.equal(b.app.words.saveEdit(), false);
  assert.match(b.elements.get('wordError').textContent, /zaten var/);
  assert.equal(b.app.words.deleteEdited(), true);
  assert.equal(b.saved().decks.Test.map(card => card.id).join(), 'b');
  assert.ok(!b.saved().program.session.ids.includes('a'));
  assert.ok(!('a' in b.saved().program.cards));
});

test('backup accepts exported and raw data, rejects other files and restores progress', () => {
  const b = browser();
  const { parseBackup } = b.app.backup;
  assert.match(parseBackup('not json').error, /okunamadı/);
  assert.match(parseBackup('{"hello":1}').error, /yedeği değil/);
  assert.match(parseBackup('{"decks":{"A":[{"id":"1","en":"x"}]}}').error, /eksik/);
  const data = { decks: { A: [{ id: '1', en: 'x', tr: 'y', box: 1, due: 0 }] }, pts: 7, streak: 2, last: '', today: 0, cur: null };
  const plain = value => JSON.parse(JSON.stringify(value));
  assert.deepEqual(plain(parseBackup(JSON.stringify(data)).data), data);
  const wrapped = parseBackup(JSON.stringify({ app: 'yds-vocab', version: 1, data }));
  assert.deepEqual(plain(wrapped.data), data);
  b.app.backup.restoreBackup(wrapped.data);
  assert.equal(b.saved().pts, 7);
  assert.equal(b.elements.get('home').hidden, false);
  assert.match(b.elements.get('backupStatus').textContent, /Henüz yedek/);
});

test('several saves in one user action are written to storage once', () => {
  const b = browser({ decks: { Test: [{ id: 'a', en: 'abate', tr: 'azalmak', box: 1, due: 0 }] }, pts: 0, streak: 0, last: '', today: 0, cur: null });
  const queued = [];
  let writes = 0;
  const setItem = b.context.localStorage.setItem;
  b.context.localStorage.setItem = (...args) => { writes++; setItem(...args); };
  b.context.queueMicrotask = task => queued.push(task);
  b.app.store.data.pts = 5; b.app.store.save();
  b.app.store.data.pts = 6; b.app.store.save();
  b.app.store.save();
  assert.equal(writes, 0);
  assert.equal(queued.length, 1);
  queued.shift()();
  assert.equal(writes, 1);
  assert.equal(b.saved().pts, 6);
  b.app.store.save(); b.app.store.flush();
  assert.equal(writes, 2);
  queued.shift()();
  assert.equal(writes, 2, 'a flushed write is not repeated');
});
