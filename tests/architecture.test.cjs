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
    'back', 'playBack', 'gameAgain', 'spkW', 'spkS', 'programStart', 'programStudy', 'dailyReturn']) {
    assert.equal(typeof b.elements.get(id).onclick, 'function', id);
  }
  assert.equal(typeof b.elements.get('file').onchange, 'function');
  assert.equal(b.listeners.window.length, 1);
  assert.equal(b.listeners.window[0][0], 'focus');
  assert.equal(b.listeners.document.length, 1);
  assert.equal(b.listeners.document[0][0], 'visibilitychange');
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
