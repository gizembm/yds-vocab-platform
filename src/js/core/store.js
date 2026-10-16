// Persisted vocabulary and progress. Keep the storage key and data shape backward compatible.
(() => {
  'use strict';

  const app = globalThis.Vocab;
  const { STORAGE_KEY } = app.config;
  const store = app.store;

  store.data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || {
    decks: {}, pts: 0, streak: 0, last: '', today: 0, cur: null
  };
  store.save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(store.data));
  store.allCards = () => Object.values(store.data.decks).flat();
  store.cardsOf = name => name ? store.data.decks[name] || [] : store.allCards();
  store.cardCat = card => Object.keys(store.data.decks)
    .find(name => store.data.decks[name].includes(card)) || '';
})();
