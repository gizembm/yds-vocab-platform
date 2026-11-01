// Persisted vocabulary and progress. Keep the storage key and data shape backward compatible.
(() => {
  'use strict';

  const app = globalThis.Vocab;
  const { STORAGE_KEY, HARD_SCOPE, HARD_MIN_SCORE, HARD_LIMIT } = app.config;
  const store = app.store;

  store.data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || {
    decks: {}, pts: 0, streak: 0, last: '', today: 0, cur: null
  };
  // One user action can call save() several times; serializing ~0.5 MB each time made
  // every card rating slow. Saves are coalesced into one write at the end of the
  // current task (a microtask runs before the browser handles any other event).
  let writeQueued = false;
  const write = () => {
    writeQueued = false;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store.data));
  };
  store.save = () => {
    if (typeof queueMicrotask !== 'function')return write();
    if (writeQueued)return;
    writeQueued = true;
    queueMicrotask(() => {
      if (writeQueued)write();
    });
  };
  store.flush = () => {
    if (writeQueued)write();
  };
  store.allCards = () => Object.values(store.data.decks).flat();

  // Mistake score: each difficulty grows on errors (+2, "hard" +1) and shrinks on correct answers (-1).
  store.difficulty = card => (card.cardDifficulty || 0) + (card.quizDifficulty || 0) +
    (card.matchDifficulty || 0) + (card.sentenceDifficulty || 0);
  // All hard words, or only those of one category.
  store.hardCards = (deck = null) => (deck === null ? store.allCards() : store.data.decks[deck] || [])
    .filter(card => store.difficulty(card) >= HARD_MIN_SCORE)
    .sort((a, b) => store.difficulty(b) - store.difficulty(a))
    .slice(0, HARD_LIMIT);
  store.adjustDifficulty = (card, field, change) => {
    card[field] = Math.max(0, Math.min(8, (card[field] || 0) + change));
  };
  // A correct answer lowers the total score, taken from the largest field, so a word that
  // became hard through games can also leave the hard list from the flashcards.
  store.easeDifficulty = card => {
    const fields = ['cardDifficulty', 'quizDifficulty', 'matchDifficulty', 'sentenceDifficulty'];
    const field = fields.reduce((a, b) => (card[b] || 0) > (card[a] || 0) ? b : a);
    if (card[field] > 0)card[field]--;
  };

  // Shared by file import and manual entry so both create the same card shape.
  store.createCard = ({ en, tr, ex = '', exTr = '', synonyms = '', antonyms = '' }) => ({
    id: Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    en, tr, ex, exTr, synonyms, antonyms, box: 1, due: 0
  });
  store.hasWord = (deckName, en, except = null) => (store.data.decks[deckName] || [])
    .some(card => card !== except && card.en.toLowerCase() === en.toLowerCase());
  // A category's hard words use the scope "__hard__:<category>".
  store.hardScope = deck => HARD_SCOPE + ':' + deck;
  store.hardDeckOf = scope => typeof scope === 'string' && scope.startsWith(HARD_SCOPE + ':')
    ? scope.slice(HARD_SCOPE.length + 1) : null;
  store.isHardScope = scope => scope === HARD_SCOPE || store.hardDeckOf(scope) !== null;
  store.cardsOf = name => name === HARD_SCOPE ? store.hardCards()
    : store.hardDeckOf(name) !== null ? store.hardCards(store.hardDeckOf(name))
      : name ? store.data.decks[name] || [] : store.allCards();
  store.scopeLabel = name => name === HARD_SCOPE ? 'Zor kelimelerim'
    : store.hardDeckOf(name) !== null ? store.hardDeckOf(name) + ' · zor kelimeler'
      : name || 'Tüm kategoriler';
  store.cardCat = card => Object.keys(store.data.decks)
    .find(name => store.data.decks[name].includes(card)) || '';
})();
