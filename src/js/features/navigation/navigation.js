// navigation: feature implementation. DOM events are connected in bootstrap.js.
(() => {
  'use strict';

  const { store, decks, navigation } = globalThis.Vocab;
  const { $ } = globalThis.Vocab.utils;

  const { study: studyState, play: playState } = globalThis.Vocab.session;

  function showHome() {
    store.data.lastView = { type: 'home' };
    store.save();
    studyState.daily = false;
    playState.daily = false;
    clearTimeout(playState.quiz.timer);
    playState.quiz.timer = null;
    clearTimeout(playState.match.timer);
    playState.match.timer = null;
    playState.match.pick = [];
    $('study').hidden = true;
    $('play').hidden = true;
    $('home').hidden = false;
    decks.renderDecks();
  }

  function showPlay(mode, name) {
    $('nextDailyDay').hidden = true;
    playState.daily = false;
    studyState.daily = false;
    $('gameAgain').textContent = 'Yeniden karıştır';
    clearTimeout(playState.quiz.timer);
    playState.quiz.timer = null;
    clearTimeout(playState.match.timer);
    playState.match.timer = null;
    playState.match.pick = [];
    playState.mode = mode;
    playState.scope = name;
    store.data.lastView = { type: 'play', mode, scope: name || null };
    store.save();
    $('home').hidden = true;
    $('study').hidden = true;
    $('play').hidden = false;
    $('playInfo').textContent = (name || 'Tüm kategoriler') + ' · ' + store.cardsOf(name).length + ' kart';
    $('matchBoard').hidden = mode !== 'match';
    $('quizBox').hidden = mode === 'match';
    $('quizBox').className = 'quiz-box' + (mode === 'sentence' ? ' sentence-mode' : '');
  }

  Object.assign(navigation, {
    showHome,
    showPlay
  });
})();
