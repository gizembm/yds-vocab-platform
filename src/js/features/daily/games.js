// daily-games: feature implementation. DOM events are connected in bootstrap.js.
(() => {
  'use strict';

  const { store, decks, navigation, matching, sentence, daily } = globalThis.Vocab;
  const { $, shuffle } = globalThis.Vocab.utils;

  const { study: studyState, play: playState } = globalThis.Vocab.session;

  function startDailyGame(mode) {
    if (!['quiz', 'match', 'sentence'].includes(mode))return;
    if (daily.refreshDailyDay())return;
    const s = daily.ensureDaily();
    if (s.pending.length || !s.ids.length)return;
    if (mode === 'match' && s.ids.length < 2 || mode === 'quiz' && new Set(daily.dailyCards().map(c => c.tr)).size < 2)return;
    const ids = mode === 'sentence' ? sentence.sentenceCards(daily.dailyCards()).map(c => c.id) : s.ids;
    if (mode === 'sentence' && (!ids.length || new Set(store.allCards().map(c => sentence.englishKey(c.en))).size < 4))return;
    navigation.showPlay(mode, null);
    playState.daily = true;
    studyState.daily = false;
    const game = s[mode];
    if (game.pending === null)game.pending = shuffle([...ids]);
    store.save();
    $('gameAgain').textContent = 'Turu yeniden başlat';
    $('playTitle').textContent = mode === 'sentence' ? 'Günlük Cümle Tamamla' : mode === 'quiz' ? 'Günlük test' : 'Günlük eşleştirme';
    if (mode === 'sentence')sentence.showSentence();
    else if (mode === 'quiz')daily.dailyShowQuiz();
    else daily.dailyBuildMatch();
  }

  function dailyGameStatus() {
    const s = store.data.program.session, game = s[playState.mode];
    const total = playState.mode === 'sentence' ? sentence.sentenceCards(daily.dailyCards()).length : s.ids.length;
    $('playInfo').textContent = 'Günlük çalışma · ' + game.done.length + ' / ' + total + ' tamamlandı';
    $('playHint').textContent = game.pending.length
    ? (playState.mode === 'sentence' ? 'Boşluğu dört seçenekten doğru İngilizce kelimeyle tamamla. ' : 'Bugün çalıştığın kelimeler. ') + 'Yanlışlar kart çalışmasına da geri döner.'
    : 'Tur tamamlandı!' + (s.pending.length ? ' Yanlış yaptığın kelimeleri kartlarda yeniden çalış.' : ' Diğer oyuna ana ekrandan geçebilirsin.');
  }

  function restartDailyGame() {
    if (daily.refreshDailyDay())return;
    clearTimeout(playState.quiz.timer);
    playState.quiz.timer = null;
    clearTimeout(playState.match.timer);
    playState.match.timer = null;
    const s = store.data.program.session;
    const ids = playState.mode === 'sentence' ? sentence.sentenceCards(daily.dailyCards()).map(c => c.id) : s.ids;
    s[playState.mode] = {
      pending : shuffle([...ids]), done : []
    };
    store.save();
    if (playState.mode === 'sentence')sentence.showSentence();
    else if (playState.mode === 'quiz')daily.dailyShowQuiz();
    else daily.dailyBuildMatch();
  }

  function dailyShowQuiz() {
    daily.dailyGameStatus();
    const s = store.data.program.session, game = s.quiz;
    const c = daily.dailyCards().find(c => c.id === game.pending[0]), choices = $('quizChoices');
    choices.innerHTML = '';
    playState.quiz.locked = false;
    $('quizFeedback').textContent = '';
    $('quizFeedback').className = 'feedback';
    $('quizWord').textContent = c ? c.en : '';
    $('quizExample').textContent = c ? c.ex || '' : '';
    $('quizCat').textContent = c ? store.cardCat(c) : '';
    if (!c)return;
    const wrong = shuffle([...new Set(daily.dailyCards().map(x => x.tr))].filter(tr => tr !== c.tr)).slice(0, 3);
    shuffle([c.tr, ...wrong]).forEach(opt => {
      const button = document.createElement('button');
      button.textContent = opt;
      button.onclick = () => daily.dailyAnswerQuiz(button, opt === c.tr, c);
      choices.append(button);
    });
  }

  function dailyAnswerQuiz(button, ok, c) {
    if (daily.refreshDailyDay() || playState.quiz.locked)return;
    playState.quiz.locked = true;
    const game = store.data.program.session.quiz, id = game.pending.shift();
    if (ok) {
      game.done.push(id);
      c.quizCorrect = (c.quizCorrect || 0) + 1;
      c.quizDifficulty = Math.max(0, (c.quizDifficulty || 0) - 1);
      store.data.pts += 5;
    }
    else {
      game.pending.splice(Math.min(2, game.pending.length), 0, id);
      daily.dailyMistake(id);
      c.quizDifficulty = Math.min(8, (c.quizDifficulty || 0) + 2);
    }
    button.classList.add(ok ? 'good' : 'bad');
    $('quizFeedback').textContent = ok ? 'Doğru!' : 'Doğru cevap: ' + c.tr;
    [...$('quizChoices').children].forEach(b => {
      if (b.textContent === c.tr)b.classList.add('good');
    });
    store.save();
    decks.renderStats();
    playState.quiz.timer = setTimeout(() => {
      playState.quiz.timer = null;
      if (!daily.refreshDailyDay())daily.dailyShowQuiz();
    }, 1000);
  }

  function dailyBuildMatch() {
    clearTimeout(playState.match.timer);
    playState.match.timer = null;
    playState.match.pick = [];
    daily.dailyGameStatus();
    const board = $('matchBoard');
    board.innerHTML = '';
    const game = store.data.program.session.match, cards = daily.dailyCards();
    playState.match.cards = game.pending.slice(0, 6).map(id => cards.find(c => c.id === id)).filter(Boolean);
    if (!playState.match.cards.length)return;
    // A final single word remains playable inside a deck that started with >=2 cards.
    ['en', 'tr'].forEach(type => {
      const column = document.createElement('div');
      column.className = 'match-column';
      const heading = document.createElement('h3');
      heading.textContent = type === 'en' ? 'İngilizce' : 'Türkçe';
      column.append(heading);
      (type === 'en' ? playState.match.cards : shuffle(playState.match.cards)).forEach(c => {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.type = type;
        button.lang = type;
        matching.setMatchTile(button, c);
        button.onclick = () => daily.dailyPickMatch(button);
        column.append(button);
      });
      board.append(column);
    });
  }

  function dailyPickMatch(button) {
    if (daily.refreshDailyDay() || playState.match.timer !== null || playState.match.pick.includes(button))return;
    if (playState.match.pick.length && playState.match.pick[0].dataset.type === button.dataset.type) {
      playState.match.pick[0].classList.remove('active');
      playState.match.pick[0].setAttribute('aria-pressed', 'false');
      playState.match.pick = [];
    }
    button.classList.add('active');
    button.setAttribute('aria-pressed', 'true');
    playState.match.pick.push(button);
    if (playState.match.pick.length < 2)return;
    const en = playState.match.pick.find(b => b.dataset.type === 'en'), tr = playState.match.pick.find(b => b.dataset.type === 'tr');
    const card = playState.match.cards.find(c => c.id === en.dataset.id), ok = card.tr === tr.textContent;
    const game = store.data.program.session.match;
    if (ok) {
      // Equivalent translations can be swapped, but only the answered English word is credited.
      game.pending = game.pending.filter(id => id !== card.id);
      game.done.push(card.id);
      card.matchDifficulty = Math.max(0, (card.matchDifficulty || 0) - 1);
      store.data.pts += 4;
    } else {
      new Set(playState.match.pick.map(b => b.dataset.id)).forEach(id => {
        daily.dailyMistake(id);
        const c = playState.match.cards.find(c => c.id === id);
        c.matchDifficulty = Math.min(8, (c.matchDifficulty || 0) + 2);
      });
      const ids = playState.match.pick.map(b => b.dataset.id);
      game.pending = [...game.pending.filter(id => !ids.includes(id)), ...ids];
    }
    playState.match.pick.forEach(b => b.classList.add(ok ? 'done' : 'bad'));
    store.save();
    decks.renderStats();
    playState.match.timer = setTimeout(() => {
      playState.match.timer = null;
      if (!daily.refreshDailyDay())daily.dailyBuildMatch();
    }, ok ? 450 : 600);
  }

  Object.assign(daily, {
    startDailyGame,
    dailyGameStatus,
    restartDailyGame,
    dailyShowQuiz,
    dailyAnswerQuiz,
    dailyBuildMatch,
    dailyPickMatch
  });
})();
