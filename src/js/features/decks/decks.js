// decks: feature implementation. DOM events are connected in bootstrap.js.
(() => {
  'use strict';

  const { config, store, decks, study, matching, quiz, sentence, daily, backup, progress } = globalThis.Vocab;
  const { $, dstr } = globalThis.Vocab.utils;

  function renderStats() {
    const t = dstr(Date.now());
    if (store.data.last !== t && store.data.today) {
      store.data.today = 0;
    }
    // A missed day breaks the streak; show 0 until the next study session restarts it.
    const active = store.data.last === t || store.data.last === dstr(Date.now() - config.DAY);
    $('streak').textContent = active ? store.data.streak : 0;
    $('pts').textContent = store.data.pts;
    $('today').textContent = store.data.today;
  }

  function renderDecks() {
    decks.renderStats();
    daily.renderDaily();
    backup.renderBackup();
    progress.renderMastery();
    const box = $('decks');
    box.innerHTML = '';
    const names = Object.keys(store.data.decks);
    if (!names.length) {
      box.innerHTML = '<p class="hint">Henüz kategori yok. Bir dosya yükle veya kategori ekle.</p>';
      return;
    }
    const mk = (name, cards, scope, deletable) => {
      const due = cards.filter(c => c.due <= Date.now()).length;
      const el = document.createElement('div');
      el.className = 'deck' + (scope === config.HARD_SCOPE ? ' hard-deck' : '');
      el.innerHTML = '<div><b></b><small></small></div><div></div>';
      el.querySelector('b').textContent = name;
      el.querySelector('small').textContent = scope === config.HARD_SCOPE
        ? cards.length + ' kelime · en \u00e7ok hata yapt\u0131klar\u0131n'
        : cards.length + ' kart · ' + due + ' tekrar bekliyor';
      const actions = el.lastChild;
      actions.className = 'deck-actions';
      const add = (label, onclick, className = 'play', disabled = false) => {
        const button = document.createElement('button');
        button.className = className;
        button.textContent = label;
        button.disabled = disabled;
        button.onclick = onclick;
        actions.append(button);
      };
      add('Çalış', () => study.startStudy(scope), '');
      add('Eşleştir', () => matching.startMatch(scope));
      add('Soru-Cevap', () => quiz.startQuiz(scope));
      for (const [relation, label] of [['synonyms', 'Eş Anlam Bul'], ['antonyms', 'Zıt Anlam Bul']]) {
        add(label, () => quiz.startRelation(scope, relation), 'play', !cards.some(card => String(card[relation] || '').trim()));
      }
      add('Cümle Tamamla', () => sentence.startSentence(scope));
      if (deletable) {
        add('Sil', () => {
          if (confirm('"' + name + '" kategorisi silinsin mi?')) {
            delete store.data.decks[name];
            store.save();
            decks.renderDecks();
          }
        }, 'del');
      }
      if (scope === config.HARD_SCOPE)el.append(decks.hardWordList(cards));
      box.append(el);
    };
    const hard = store.hardCards();
    if (hard.length)mk('Zor kelimelerim', hard, config.HARD_SCOPE, false);
    if (names.length > 1)mk('Tüm kategoriler', names.flatMap(n => store.data.decks[n]), null, false);
    names.forEach(n => mk(n, store.data.decks[n], n, true));
  }

  // Collapsible list so the hard words can be read before practising them.
  function hardWordList(cards) {
    const details = document.createElement('details');
    details.className = 'hard-list';
    const summary = document.createElement('summary');
    summary.textContent = 'Kelimeleri gör';
    const list = document.createElement('ul');
    cards.forEach(card => {
      const item = document.createElement('li');
      const en = document.createElement('b');
      en.lang = 'en';
      en.textContent = card.en;
      const tr = document.createElement('span');
      tr.textContent = card.tr;
      const score = document.createElement('span');
      score.className = 'repeat-count';
      score.title = 'Hata puan\u0131';
      score.textContent = String(store.difficulty(card));
      item.append(en, tr, score);
      list.append(item);
    });
    details.append(summary, list);
    return details;
  }

  function addDeck() {
    const n = $('newDeck').value.trim();
    if (!n)return;
    store.data.decks[n] = store.data.decks[n] || [];
    $('newDeck').value = '';
    store.save();
    decks.renderDecks();
  }

  Object.assign(decks, {
    renderStats,
    renderDecks,
    hardWordList,
    addDeck
  });
})();
