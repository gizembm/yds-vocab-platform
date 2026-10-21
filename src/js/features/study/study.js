// study: feature implementation. DOM events are connected in bootstrap.js.
(() => {
  'use strict';

  const { config, store, decks, study, daily } = globalThis.Vocab;
  const { $, dstr } = globalThis.Vocab.utils;

  const { study: studyState, play: playState } = globalThis.Vocab.session;

  const studyCards = () => store.cardsOf(studyState.scope);

  function buildQueue() {
    if (studyState.daily) {
      studyState.queue = daily.dailyQueue();
      studyState.index = Math.max(0, studyState.queue.findIndex(c => c.id === store.data.program.session.current));
      return;
    }
    const now = Date.now();
    studyState.queue = study.studyCards().filter(c => studyState.forceAll || c.due <= now).sort((a, b) => a.box - b.box || a.due - b.due);
    const i = studyState.queue.findIndex(c => c.id === store.data.cur);
    // kaldığın karttan devam
    studyState.index = i >= 0 ? i : 0;
  }

  function startStudy(name) {
    studyState.daily = false;
    playState.daily = false;
    clearTimeout(playState.quiz.timer);
    playState.quiz.timer = null;
    clearTimeout(playState.match.timer);
    playState.match.timer = null;
    $('play').hidden = true;
    $('all').hidden = false;
    $('dailyStudyDone').hidden = true;
    studyState.scope = name;
    store.data.lastView = { type: 'study', scope: name || null };
    store.save();
    studyState.forceAll = false;
    $('home').hidden = true;
    $('study').hidden = false;
    study.showCard();
  }

  function showCard() {
    study.buildQueue();
    const c = studyState.queue[studyState.index];
    $('empty').hidden = studyState.daily || !!c;
    $('game').hidden = !c;
    $('info').textContent = (studyState.scope || 'Tüm kategoriler') + ' · ' + studyState.queue.length + ' kart sırada';
    if (studyState.daily) {
      $('info').textContent = 'Günlük çalışma · ' + studyState.queue.length + ' kelime kaldı';
      $('all').hidden = true;
      $('dailyStudyDone').hidden = !!c;
      if (!c)daily.renderDailyActions('dailyStudyActions');
    }
    $('cardPosition').textContent = c ? (studyState.index + 1) + ' / ' + studyState.queue.length : '';
    $('prevCard').disabled = !c || studyState.index === 0;
    $('nextCard').disabled = !c || studyState.index === studyState.queue.length - 1;
    if (!c) {
      if (!studyState.daily)store.data.cur = null;
      store.save();
      return;
    }
    if (studyState.daily)store.data.program.session.current = c.id;
    else store.data.cur = c.id;
    store.save();
    studyState.flipped = false;
    $('card').classList.remove('flip');
    $('rate').hidden = true;
    $('cat').textContent = Object.keys(store.data.decks).find(k => store.data.decks[k].includes(c)) || '';
    $('en').textContent = c.en;
    $('tr').textContent = c.tr;
    $('ex').textContent = c.ex;
    $('exTr').textContent = c.exTr;
    $('synonyms').textContent = c.synonyms ? 'Eş anlamlı: ' + c.synonyms : '';
    $('antonyms').textContent = c.antonyms ? 'Zıt anlamlı: ' + c.antonyms : '';
  }

  function flipCard() {
    studyState.flipped = !studyState.flipped;
    $('card').classList.toggle('flip', studyState.flipped);
    if (studyState.flipped)$('rate').hidden = false;
  }

  function moveCard(step) {
    const next = studyState.index + step;
    if (next < 0 || next >= studyState.queue.length)return;
    if (studyState.daily)store.data.program.session.current = studyState.queue[next].id;
    else store.data.cur = studyState.queue[next].id;
    store.save();
    study.showCard();
  }

  function rateStudy(e) {
    const q = e.target.dataset.q;
    if (!q)return;
    if (studyState.daily) {
      daily.rateDaily(q);
      return;
    }
    const c = studyState.queue[studyState.index];
    if (!c)return;
    if (q === 'know') {
      c.box = Math.min(5, c.box + 1);
      store.data.pts += 10;
      c.due = Date.now() + config.LEITNER_INTERVALS[c.box] * config.DAY;
    }
    else if (q === 'hard') {
      store.data.pts += 3;
      c.due = Date.now() + Math.max(1, config.LEITNER_INTERVALS[c.box]) * config.DAY / (c.box > 1 ? 2 : 1);
    }
    else {
      c.box = 1;
      c.due = Date.now() + 60 * 1000;
    } // 1 dk sonra tekrar
    const t = dstr(Date.now());
    if (store.data.last !== t) {
      store.data.streak = store.data.last === dstr(Date.now() - config.DAY) ? store.data.streak + 1 : 1;
      store.data.last = t;
      store.data.today = 0;
    }
    store.data.today++;
    decks.renderStats();
    const next = studyState.queue[(studyState.index + 1)%studyState.queue.length];
    store.data.cur = next && next.id !== c.id ? next.id : null;
    store.save();
    study.showCard();
  }

  function showAllCards() {
    studyState.forceAll = true;
    study.showCard();
  }

  Object.assign(study, {
    buildQueue,
    startStudy,
    showCard,
    flipCard,
    moveCard,
    rateStudy,
    showAllCards,
    studyCards
  });
})();
