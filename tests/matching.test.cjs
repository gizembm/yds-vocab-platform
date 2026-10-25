const assert = require('node:assert/strict');
const { loadApplication } = require('./helpers/load-app.cjs');
const vm = require('node:vm');
const { test } = require('node:test');

function game(count = 12, translations) {
  class Element {
    constructor() { this.children = []; this.dataset = {}; this.classes = new Set(); }
    set innerHTML(value) { this.children = []; }
    set className(value) { this.classes = new Set(value.split(' ')); }
    get classList() {
      return {
        add: (...names) => names.forEach(n => this.classes.add(n)),
        remove: (...names) => names.forEach(n => this.classes.delete(n)),
        contains: name => this.classes.has(name)
      };
    }
    append(...children) { this.children.push(...children); }
    showModal() { this.open = true; }
    setAttribute(name, value) { this[name] = value; }
    querySelectorAll() { return this.children.flatMap(c => c.children).filter(c => c.dataset.id); }
  }
  const elements = new Map(), timers = new Map();
  let saved, timerId = 0;
  const cards = Array.from({ length: count }, (_, i) => ({
    id: String(i), en: 'word' + i, tr: translations?.[i] || 'meaning' + i, due: 0, box: 1
  }));
  const context = vm.createContext({
    document: {
      getElementById(id) { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); },
      createElement() { return new Element(); }
    },
    localStorage: { getItem: () => saved ? JSON.stringify(saved) : null, setItem(key, value) { saved = JSON.parse(value); } },
    setTimeout(fn) { timers.set(++timerId, fn); return timerId; },
    clearTimeout(id) { timers.delete(id); },
    Math, Date
  });
  loadApplication(context, () => {
    vm.runInContext('renderDecks=()=>{};', context);
  });
  context.testCards = cards;
  vm.runInContext("S.decks={Test:testCards};renderDecks=()=>{};startMatch('Test');", context);
  return {
    context, cards, elements,
    run: code => vm.runInContext(code, context),
    tiles: () => elements.get('matchBoard').querySelectorAll(),
    flush() { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); },
    saved: () => saved
  };
}

test('separate language columns and replace a correct pair without duplicates', () => {
  const g = game(), columns = g.elements.get('matchBoard').children;
  assert.equal(columns.length, 2);
  assert.ok(columns[0].children.slice(1).every(b => b.dataset.type === 'en'));
  assert.ok(columns[1].children.slice(1).every(b => b.dataset.type === 'tr'));
  const en = g.tiles()[0], id = en.dataset.id;
  const tr = g.tiles().find(b => b.dataset.type === 'tr' && b.dataset.id === id);
  en.onclick(); tr.onclick();
  assert.equal(g.saved().pts, 4);
  g.flush();
  assert.notEqual(en.dataset.id, id);
  assert.equal(en.dataset.id, tr.dataset.id);
  assert.equal(new Set(g.tiles().filter(b => b.dataset.type === 'en').map(b => b.dataset.id)).size, 6);
});

test('same-language selections switch selection without counting a mistake', () => {
  const g = game(), [a, b] = g.tiles();
  a.onclick(); b.onclick();
  assert.equal(a.classList.contains('active'), false);
  assert.equal(b.classList.contains('active'), true);
  assert.ok(g.cards.every(c => !c.matchDifficulty));
});

test('a wrong pair penalizes only the English word and correct matches reduce it', () => {
  const g = game(), a = g.tiles()[0];
  const wrong = g.tiles().find(b => b.dataset.type === 'tr' && b.dataset.id !== a.dataset.id);
  a.onclick(); wrong.onclick();
  assert.equal(g.saved().decks.Test.find(c => c.id === a.dataset.id).matchDifficulty, 2);
  assert.equal(g.saved().decks.Test.find(c => c.id === wrong.dataset.id).matchDifficulty, undefined);
  g.flush();
  const right = g.tiles().find(b => b.dataset.type === 'tr' && b.dataset.id === a.dataset.id);
  right.onclick(); a.onclick();
  assert.equal(g.saved().decks.Test.find(c => c.id === a.dataset.id).matchDifficulty, 1);
});

test('difficult words receive a larger selection probability', () => {
  const g = game();
  assert.equal(g.run(`
    const difficult={id:'hard',matchDifficulty:2}, easy={id:'easy'};
    let hits=0;
    for(let i=0;i<800;i++){
      matchSeen=new Map();
      const original=Math.random;Math.random=()=>i/800;
      if(chooseMatchCard([difficult,easy])===difficult)hits++;
      Math.random=original;
    }
    hits;
  `), 700);
});

test('small decks remain playable and reshuffling cancels pending callbacks', () => {
  const g = game(2), a = g.tiles()[0];
  const b = g.tiles().find(tile => tile.dataset.type === 'tr' && tile.dataset.id === a.dataset.id);
  a.onclick(); b.onclick(); g.flush();
  assert.equal(g.tiles().length, 4);
  assert.ok(g.tiles().every(tile => !tile.classList.contains('done')));
  a.onclick(); b.onclick(); g.run('buildMatch()');
  const ids = g.tiles().map(tile => tile.dataset.id);
  g.flush();
  assert.deepEqual(g.tiles().map(tile => tile.dataset.id), ids);
  assert.equal(g.run('matchPick.length'), 0);
});

test('equivalent translations are accepted without leaving orphan tiles', () => {
  const g = game(2, ['same meaning', 'same meaning']), a = g.tiles()[0];
  const b = g.tiles().find(tile => tile.dataset.type === 'tr' && tile.dataset.id !== a.dataset.id);
  a.onclick(); b.onclick(); g.flush();
  assert.equal(g.saved().pts, 4);
  assert.ok(g.tiles().every(tile => !tile.classList.contains('done')));
  assert.equal(new Set(g.tiles().map(tile => tile.dataset.id)).size, 2);
});

function answer(g, correct) {
  const word = g.elements.get('quizWord').textContent;
  const card = g.cards.find(c => c.en === word);
  const button = g.elements.get('quizChoices').children.find(b => (b.textContent === card.tr) === correct);
  button.onclick();
  g.flush();
  return card;
}

test('quiz starts with past mistakes, then unknown words, then known words', () => {
  const g = game(5);
  g.cards[0].quizCorrect = 3;
  g.cards[1].quizDifficulty = 4;
  g.cards[2].box = 5;
  g.cards[3].matchDifficulty = 2;
  g.run("startQuiz('Test')");
  assert.deepEqual(Array.from(g.run('quizList.map(entry=>entry.card.id)')), ['1', '3', '4', '0', '2']);
});

test('quiz mistakes return after two intervening questions and persist', () => {
  const g = game(10);
  g.run("startQuiz('Test')");
  const mistaken = answer(g, false);
  assert.equal(g.saved().decks.Test.find(c => c.id === mistaken.id).quizDifficulty, 2);
  assert.notEqual(answer(g, true).id, mistaken.id);
  assert.notEqual(answer(g, true).id, mistaken.id);
  assert.equal(g.elements.get('quizWord').textContent, mistaken.en);
  answer(g, true);
  assert.equal(g.saved().decks.Test.find(c => c.id === mistaken.id).quizDifficulty, 1);
  g.run("S=JSON.parse(localStorage.getItem(KEY)||'null')||S;startQuiz('Test')");
  assert.equal(g.elements.get('quizWord').textContent, mistaken.en);
});

test('quiz learned words get longer intervals without starving the remaining cards', () => {
  const g = game(8);
  g.cards.forEach(c => { c.quizCorrect = 2; });
  g.run("startQuiz('Test')");
  const visited = new Set();
  for (let i = 0; i < 8; i++) visited.add(answer(g, true).id);
  assert.equal(visited.size, 8);
  assert.ok(g.run('quizList.every(entry=>entry.due>=16)'));
});

test('quiz feedback timers cancel on restart, navigation, or switching games', () => {
  const g = game();
  for (const action of ["startQuiz('Test')", 'showHome()', "startMatch('Test')"]) {
    g.run("startQuiz('Test')");
    const current = g.elements.get('quizWord').textContent;
    const card = g.cards.find(c => c.en === current);
    const button = g.elements.get('quizChoices').children.find(b => b.textContent === card.tr);
    const previous = card.quizCorrect || 0;
    button.onclick();button.onclick();
    assert.equal(card.quizCorrect, previous + 1);
    g.run(action);
    const after = g.elements.get('quizWord').textContent;
    g.flush();
    assert.equal(g.elements.get('quizWord').textContent, after);
    assert.equal(g.run('quizTimer'), null);
  }
});

test('empty and single-card quizzes remain safe', () => {
  const empty = game(0);
  empty.run("startQuiz('Test')");
  assert.equal(empty.elements.get('quizWord').textContent, '');
  const single = game(1);
  single.run("startQuiz('Test')");
  answer(single, true);
  assert.equal(single.elements.get('quizWord').textContent, single.cards[0].en);
});

test('import reports repeated words, row counts and invalid rows without changing existing cards', () => {
  const g = game(2);
  const existing = { ...g.cards[0] };
  g.context.rows = [
    ['Test', ' WORD0 ', 'changed meaning'],
    ['Test', 'word0', 'another meaning'],
    ['Test', 'fresh', 'new meaning'],
    ['Test', 'FRESH', 'new meaning'],
    ['Test', 'missing', '']
  ];
  g.run('addRows(rows)');
  assert.equal(g.elements.get('importAdded').textContent, 1);
  assert.equal(g.elements.get('importDuplicate').textContent, 3);
  assert.equal(g.elements.get('importInvalid').textContent, 1);
  assert.equal(g.elements.get('importRepeatedTitle').textContent, 'Tekrarlı İngilizce kelimeler (2)');
  const list = g.elements.get('importRepeatedList').children;
  assert.equal(list.length, 2);
  assert.equal(list[0].children[0].textContent, 'WORD0');
  assert.equal(list[0].children[2].textContent, '2 satır');
  assert.deepEqual(g.saved().decks.Test[0], existing);
  assert.equal(g.saved().decks.Test.length, 3);
  assert.equal(g.elements.get('importResult').open, true);
});

test('import keeps category-specific duplicates and safely renders imported text', () => {
  const g = game(1);
  g.context.rows = [
    ['Other', 'word0', 'meaning'],
    ['Other', 'WORD0', 'meaning'],
    ['Test', '<img src=x onerror=alert(1)>', 'meaning'],
    ['Test', '<img src=x onerror=alert(1)>', 'meaning']
  ];
  g.run('addRows(rows)');
  assert.equal(g.saved().decks.Other.length, 1);
  assert.equal(g.elements.get('importAdded').textContent, 2);
  assert.equal(g.elements.get('importDuplicate').textContent, 2);
  const word = g.elements.get('importRepeatedList').children[1].children[0];
  assert.equal(word.textContent, '<img src=x onerror=alert(1)>');
  assert.equal(word.children.length, 0);
});

test('import result clears old warnings for subsequent successful or empty imports', () => {
  const g = game(1);
  g.context.rows = [['Test', 'word0', 'meaning'], ['Test', '', 'meaning']];
  g.run('addRows(rows)');
  assert.equal(g.elements.get('importTitle').textContent, 'Yeni kelime eklenmedi');
  g.context.rows = [['Test', 'fresh', 'meaning']];
  g.run('addRows(rows)');
  assert.equal(g.elements.get('importRepeated').hidden, true);
  assert.equal(g.elements.get('importInvalidNote').hidden, true);
  assert.equal(g.elements.get('importRepeatedList').children.length, 0);
  assert.equal(g.elements.get('importTitle').textContent, 'Kelimeler eklendi');
  g.run('addRows([])');
  assert.equal(g.elements.get('importAdded').textContent, 0);
});
