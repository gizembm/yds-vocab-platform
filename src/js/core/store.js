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
  store.hardCards = () => store.allCards()
    .filter(card => store.difficulty(card) >= HARD_MIN_SCORE)
    .sort((a, b) => store.difficulty(b) - store.difficulty(a))
    .slice(0, HARD_LIMIT);
  store.adjustDifficulty = (card, field, change) => {
    card[field] = Math.max(0, Math.min(8, (card[field] || 0) + change));
  };

  store.cardsOf = name => name === HARD_SCOPE ? store.hardCards()
    : name ? store.data.decks[name] || [] : store.allCards();
  store.scopeLabel = name => name === HARD_SCOPE ? 'Zor kelimelerim' : name || 'Tüm kategoriler';
  store.cardCat = card => Object.keys(store.data.decks)
    .find(name => store.data.decks[name].includes(card)) || '';
})();
