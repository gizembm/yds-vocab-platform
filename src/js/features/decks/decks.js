// decks: feature implementation. DOM events are connected in bootstrap.js.
(() => {
  'use strict';

  const { store, decks, study, matching, quiz, sentence, daily } = globalThis.Vocab;
  const { $, dstr } = globalThis.Vocab.utils;

  function renderStats() {
    const t = dstr(Date.now());
    if (store.data.last !== t && store.data.today) {
      store.data.today = 0;
    }
    $('streak').textContent = store.data.streak;
    $('pts').textContent = store.data.pts;
    $('today').textContent = store.data.today;
  }

  function renderDecks() {
    decks.renderStats();
    daily.renderDaily();
    const box = $('decks');
    box.innerHTML = '';
    const names = Object.keys(store.data.decks);
    if (!names.length) {
      box.innerHTML = '<p class="hint">Henüz kategori yok. Bir dosya yükle veya kategori ekle.</p>';
      return;
    }
    const mk = (name, cards, all) => {
      const due = cards.filter(c => c.due <= Date.now()).length;
      const el = document.createElement('div');
      el.className = 'deck';
      el.innerHTML = '<div><b></b><small>' + cards.length + ' kart · ' + due + ' tekrar bekliyor</small></div><div></div>';
      el.querySelector('b').textContent = name;
      const go = document.createElement('button');
      go.textContent = 'Çalış';
      go.onclick = () => study.startStudy(all ? null : name);
      el.lastChild.append(go);
      const match = document.createElement('button');
      match.className = 'play';
      match.textContent = 'Eşleştir';
      match.onclick = () => matching.startMatch(all ? null : name);
      el.lastChild.append(match);
      const quizButton = document.createElement('button');
      quizButton.className = 'play';
      quizButton.textContent = 'Soru-Cevap';
      quizButton.onclick = () => quiz.startQuiz(all ? null : name);
      el.lastChild.append(quizButton);
      const sentenceButton = document.createElement('button');
      sentenceButton.className = 'play';
      sentenceButton.textContent = 'Cümle Tamamla';
      sentenceButton.onclick = () => sentence.startSentence(all ? null : name);
      el.lastChild.append(sentenceButton);
      if (!all) {
        const del = document.createElement('button');
        del.className = 'del';
        del.textContent = 'Sil';
        del.onclick = () => {
          if (confirm('"' + name + '" kategorisi silinsin mi?')) {
            delete store.data.decks[name];
            store.save();
            decks.renderDecks();
          }
        };
        el.lastChild.append(del);
      }
      box.append(el);
    };
    if (names.length > 1)mk('Tüm kategoriler', names.flatMap(n => store.data.decks[n]), true);
    names.forEach(n => mk(n, store.data.decks[n]));
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
    addDeck
  });
})();
