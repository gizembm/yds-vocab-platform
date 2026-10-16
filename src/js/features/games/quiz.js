// quiz: feature implementation. DOM events are connected in bootstrap.js.
(() => {
  'use strict';

  const { store, decks, navigation, quiz, daily } = globalThis.Vocab;
  const { $, shuffle } = globalThis.Vocab.utils;

  const { play: playState } = globalThis.Vocab.session;

  function startQuiz(name) {
    navigation.showPlay('quiz', name);
    $('playTitle').textContent = 'Soru-Cevap';
    $('playHint').textContent = 'Kelimenin doğru Türkçe karşılığını seç.';
    const cards = shuffle(store.cardsOf(name)).sort((a, b) => quiz.quizPriority(b) - quiz.quizPriority(a));
    playState.quiz.list = cards.map((card, i) => ({
      card, due : i
    }));
    playState.quiz.step = 0;
    quiz.showQuiz();
  }

  function quizPriority(card) {
    const difficulty = Math.max(card.quizDifficulty || 0, card.matchDifficulty || 0);
    const unknown = !(card.quizCorrect > 0) && !(card.box > 1);
    return difficulty * 10 + (unknown ? 5 : 0) + Math.max(0, 5 - (card.box || 1));
  }

  function showQuiz() {
    if (playState.daily) {
      daily.dailyShowQuiz();
      return;
    }
    const c = playState.quiz.list[0]?.card, choices = $('quizChoices');
    choices.innerHTML = '';
    $('quizFeedback').textContent = '';
    $('quizFeedback').className = 'feedback';
    playState.quiz.locked = false;
    if (!c) {
      $('quizWord').textContent = '';
      $('quizExample').textContent = '';
      $('quizCat').textContent = '';
      choices.innerHTML = '<p class="hint">Soru-cevap için kelime eklemen yeterli.</p>';
      return;
    }
    $('quizCat').textContent = store.cardCat(c);
    $('quizWord').textContent = c.en;
    $('quizExample').textContent = c.ex || '';
    const wrong = shuffle(store.cardsOf(playState.scope).filter(x => x.id !== c.id && x.tr !== c.tr)).slice(0, 3).map(x => x.tr);
    const opts = shuffle([c.tr, ...wrong]);
    opts.forEach(opt => {
      const b = document.createElement('button');
      b.textContent = opt;
      b.onclick = () => quiz.answerQuiz(b, opt === c.tr, c);
      choices.append(b);
    });
    if (opts.length < 2)$('quizFeedback').textContent = 'Daha güçlü seçenekler için aynı kategoriye birkaç kelime daha ekle.';
  }

  function answerQuiz(btn, ok, c) {
    if (playState.daily) {
      daily.dailyAnswerQuiz(btn, ok, c);
      return;
    }
    if (playState.quiz.locked)return;
    playState.quiz.locked = true;
    btn.classList.add(ok ? 'good' : 'bad');
    if (ok) {
      c.quizCorrect = (c.quizCorrect || 0) + 1;
      c.quizDifficulty = Math.max(0, (c.quizDifficulty || 0) - 1);
      store.data.pts += 5;
      $('quizFeedback').textContent = 'Doğru! ' + c.en + ' = ' + c.tr;
      $('quizFeedback').classList.add('good');
    } else {
      c.quizDifficulty = Math.min(8, (c.quizDifficulty || 0) + 2);
      $('quizFeedback').textContent = 'Doğru cevap: ' + c.tr;
      $('quizFeedback').classList.add('bad');
    }
    [...$('quizChoices').children].forEach(x => {
      if (x.textContent === c.tr)x.classList.add('good');
    });
    store.save();
    decks.renderStats();
    playState.quiz.timer = setTimeout(() => {
      const current = playState.quiz.list.shift();
      playState.quiz.step = Math.max(playState.quiz.step, current.due);
      // Repeat mistakes after two intervening questions, expanding the gap as recall improves.
      const gap = !ok ? 3 : c.quizDifficulty > 0 ? 6 : c.quizCorrect === 1 ? Math.max(8, playState.quiz.list.length * 2) : Math.max(16, playState.quiz.list.length * 3);
      current.due = playState.quiz.step + gap;
      playState.quiz.list.push(current);
      playState.quiz.step++;
      playState.quiz.list.sort((a, b) => a.due - b.due || quiz.quizPriority(b.card) - quiz.quizPriority(a.card));
      playState.quiz.timer = null;
      quiz.showQuiz();
    }, 1000);
  }

  Object.assign(quiz, {
    startQuiz,
    quizPriority,
    showQuiz,
    answerQuiz
  });
})();
