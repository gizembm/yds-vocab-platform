// progress: how far each word has come in the daily program. DOM events are connected in bootstrap.js.
(() => {
  'use strict';

  const { store, daily, progress } = globalThis.Vocab;
  const { $ } = globalThis.Vocab.utils;

  // new: not introduced yet · learning: before the first 1-day review is passed ·
  // strengthening: on the 3, 7 or 14 day steps · learned: the 14-day review was passed (30-day step).
  const LEVELS = [
    { key: 'new', label: 'Yeni', hint: 'Programa henüz girmedi' },
    { key: 'learning', label: 'Öğreniliyor', hint: 'İlk tekrarlarını bekliyor' },
    { key: 'strengthening', label: 'Pekişiyor', hint: '3, 7 ve 14 günlük tekrarlarda' },
    { key: 'learned', label: 'Öğrenildi', hint: '14 günlük tekrarı da bildin' }
  ];
  const LEARNED_STAGE = daily.REVIEW_DAYS.length - 1;

  const shortDate = date => new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', timeZone: 'UTC' })
    .format(Date.parse(date + 'T00:00:00Z'));

  function level(card) {
    const state = store.data.program?.cards?.[card.id];
    if (!state)return 'new';
    if (!state.learned || !state.stage)return 'learning';
    return state.stage >= LEARNED_STAGE ? 'learned' : 'strengthening';
  }

  function counts() {
    const result = { new: 0, learning: 0, strengthening: 0, learned: 0 };
    for (const card of store.allCards())result[level(card)]++;
    return result;
  }

  function learnedCards() {
    const cards = store.data.program?.cards || {};
    return store.allCards().filter(card => level(card) === 'learned')
      .sort((a, b) => String(cards[a.id].due).localeCompare(String(cards[b.id].due)));
  }

  function renderMastery() {
    const panel = $('masteryPanel');
    if (!panel)return;
    const total = store.allCards().length;
    panel.hidden = !total || !store.data.program;
    if (panel.hidden)return;
    const c = counts();
    const bar = $('masteryBar'), levels = $('masteryLevels');
    bar.innerHTML = '';
    levels.innerHTML = '';
    for (const { key, label, hint } of LEVELS) {
      const segment = document.createElement('span');
      segment.className = 'level-' + key;
      segment.setAttribute('style', 'flex-grow:' + c[key]);
      bar.append(segment);
      const item = document.createElement('div');
      item.className = 'mastery-level level-' + key;
      item.title = hint;
      const name = document.createElement('dt');
      name.textContent = label;
      const value = document.createElement('dd');
      value.textContent = String(c[key]);
      item.append(name, value);
      levels.append(item);
    }
    bar.setAttribute('aria-label', LEVELS.map(({ key, label }) => label + ' ' + c[key]).join(', '));
    const learned = learnedCards(), list = $('masteryList');
    $('masteryDetails').hidden = !learned.length;
    $('masterySummary').textContent = 'Öğrenilen kelimeleri gör (' + learned.length + ')';
    list.innerHTML = '';
    for (const card of learned) {
      const item = document.createElement('li');
      const en = document.createElement('b');
      en.lang = 'en';
      en.textContent = card.en;
      const tr = document.createElement('span');
      tr.textContent = card.tr;
      const due = document.createElement('span');
      due.className = 'repeat-count';
      due.textContent = 'Tekrar: ' + shortDate(store.data.program.cards[card.id].due);
      item.append(en, tr, due);
      list.append(item);
    }
  }

  Object.assign(progress, {
    LEVELS,
    level,
    counts,
    learnedCards,
    renderMastery
  });
})();
