// word-search: find an English word across every category. DOM events are connected in bootstrap.js.
(() => {
  'use strict';

  const { store, words, progress } = globalThis.Vocab;
  const { $ } = globalThis.Vocab.utils;

  const MAX_RESULTS = 20;
  const LEVEL_LABELS = { new: 'Yeni', learning: 'Öğreniliyor', strengthening: 'Pekişiyor', learned: 'Öğrenildi' };
  const normalize = text => String(text || '').trim().toLocaleLowerCase('en');

  // Exact matches first, then words starting with the query, then words containing it.
  function searchWords(query) {
    const q = normalize(query);
    if (!q)return [];
    const rank = en => en === q ? 0 : en.startsWith(q) ? 1 : en.includes(q) ? 2 : null;
    return Object.entries(store.data.decks)
      .flatMap(([deck, cards]) => cards.map(card => ({ card, deck, rank: rank(normalize(card.en)) })))
      .filter(match => match.rank !== null)
      .sort((a, b) => a.rank - b.rank || a.card.en.localeCompare(b.card.en, 'en') || a.deck.localeCompare(b.deck, 'tr'));
  }

  function renderSearch() {
    const input = $('wordSearch'), status = $('wordSearchStatus'), list = $('wordSearchResults');
    const query = input.value.trim(), matches = words.searchWords(query);
    list.innerHTML = '';
    status.hidden = !query;
    list.hidden = !matches.length;
    if (!query)return;
    if (!matches.length) {
      status.textContent = '"' + query + '" hiçbir kategoride yok.';
      return;
    }
    const exact = matches.filter(match => match.rank === 0).length;
    status.textContent = (exact ? '"' + query + '" ' + exact + ' kategoride var. ' : '"' + query + '" birebir yok. ') +
      matches.length + ' sonuç' + (matches.length > MAX_RESULTS ? ', ilk ' + MAX_RESULTS + ' tanesi gösteriliyor.' : '.');
    for (const { card, deck } of matches.slice(0, MAX_RESULTS)) {
      const item = document.createElement('li');
      const en = document.createElement('b');
      en.lang = 'en';
      en.textContent = card.en;
      const tr = document.createElement('span');
      tr.textContent = card.tr;
      const place = document.createElement('span');
      place.className = 'chip';
      place.textContent = deck;
      const level = document.createElement('span');
      level.className = 'search-level';
      level.textContent = LEVEL_LABELS[progress.level(card)] || '';
      item.append(en, tr, place, level);
      list.append(item);
    }
  }

  Object.assign(words, {
    searchWords,
    renderSearch
  });
})();
