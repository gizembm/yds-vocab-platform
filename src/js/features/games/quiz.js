// quiz: feature implementation. DOM events are connected in bootstrap.js.
(() => {
  'use strict';

  const { store, decks, navigation, quiz, daily } = globalThis.Vocab;
  const { $, shuffle } = globalThis.Vocab.utils;

  const { play: playState } = globalThis.Vocab.session;

  function startQuiz(name) {
    const resumeId = store.data.lastView?.mode === 'quiz' && store.data.lastView.scope === (name || null)
      ? store.data.lastView.cardId : null;
    navigation.showPlay('quiz', name);
    $('playTitle').textContent = 'Soru-Cevap';
    $('playHint').textContent = 'Kelimenin doğru Türkçe karşılığını seç.';
    const cards = shuffle(store.cardsOf(name)).sort((a, b) => quiz.quizPriority(b) - quiz.quizPriority(a));
    playState.quiz.list = cards.map((card, i) => ({
      card, due : i
    }));
    const resumeIndex = playState.quiz.list.findIndex(item => item.card.id === resumeId);
    // Resume a card when it is equally or more urgent than the current lead;
    // keep higher-priority mistakes at the front after a reload.
    if (resumeIndex > 0 && quiz.quizPriority(playState.quiz.list[resumeIndex].card) >= quiz.quizPriority(playState.quiz.list[0].card)) {
      playState.quiz.list.push(...playState.quiz.list.splice(0, resumeIndex));
    }
    playState.quiz.step = 0;
    quiz.showQuiz();
  }

  function relationTerms(card, relation) {
    return String(card[relation] || '').split(/[;,/|]/).map(value => value.trim()).filter(Boolean);
  }

  function startRelation(name, relation) {
    const resumeId = store.data.lastView?.mode === relation && store.data.lastView.scope === (name || null)
      ? store.data.lastView.cardId : null;
    navigation.showPlay(relation, name);
    $('playTitle').textContent = relation === 'synonyms' ? 'Eş Anlam Bul' : 'Zıt Anlam Bul';
    $('playHint').textContent = relation === 'synonyms'
      ? 'İngilizce kelimenin eş anlamlısını seç.'
      : 'İngilizce kelimenin zıt anlamlısını seç.';
    playState.quiz.list = shuffle(store.cardsOf(name).filter(card => relationTerms(card, relation).length))
      .map((card, i) => ({ card, due: i }));
    const resumeIndex = playState.quiz.list.findIndex(item => item.card.id === resumeId);
    if (resumeIndex > 0)playState.quiz.list.push(...playState.quiz.list.splice(0, resumeIndex));
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
    if (!playState.daily && store.data.lastView?.type === 'play') {
      store.data.lastView.cardId = c.id;
      store.save();
    }
    $('quizCat').textContent = store.cardCat(c);
    $('quizWord').textContent = c.en;
    $('quizExample').textContent = c.ex || '';
    const relation = ['synonyms', 'antonyms'].includes(playState.mode) ? playState.mode : null;
    const correct = relation ? relationTerms(c, relation) : [c.tr];
    const answer = correct[0];
    const wrong = shuffle(store.cardsOf(playState.scope).filter(x => x.id !== c.id)
      .flatMap(x => relation ? relationTerms(x, relation) : [x.tr])
      .filter(value => !correct.includes(value)));
    const opts = shuffle([...new Set([answer, ...wrong])].slice(0, 4));
    opts.forEach(opt => {
      const b = document.createElement('button');
      b.textContent = opt;
      b.onclick = () => quiz.answerQuiz(b, correct.includes(opt), c, answer);
      choices.append(b);
    });
    if (opts.length < 2)$('quizFeedback').textContent = 'Daha güçlü seçenekler için aynı kategoriye birkaç kelime daha ekle.';
  }

  function answerQuiz(btn, ok, c, answer = c.tr) {
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
      $('quizFeedback').textContent = 'Doğru! ' + c.en + ' = ' + answer;
      $('quizFeedback').classList.add('good');
    } else {
      c.quizDifficulty = Math.min(8, (c.quizDifficulty || 0) + 2);
      daily.registerMistake(c.id);
      $('quizFeedback').textContent = 'Doğru cevap: ' + answer;
      $('quizFeedback').classList.add('bad');
    }
    [...$('quizChoices').children].forEach(x => {
      if (x.textContent === answer)x.classList.add('good');
    });
    store.save();
    decks.renderStats();
    playState.quiz.timer = setTimeout(() => {
      const current = playState.quiz.list.shift();
      playState.quiz.step = Math.max(playState.quiz.step, current.due);
      // Repeat mistakes after two intervening questions, expanding the gap as recall improves.
      const gap = !ok ? 2 : c.quizDifficulty > 0 ? 6 : c.quizCorrect === 1 ? Math.max(8, playState.quiz.list.length * 2) : Math.max(16, playState.quiz.list.length * 3);
      current.due = playState.quiz.step + gap;
      playState.quiz.list.push(current);
      playState.quiz.step++;
      // Keep insertion order for equal due steps so a mistake returns after
      // the intended number of intervening questions.
      playState.quiz.list.sort((a, b) => a.due - b.due);
      playState.quiz.timer = null;
      quiz.showQuiz();
    }, 1000);
  }

  Object.assign(quiz, {
    startQuiz,
    startRelation,
    quizPriority,
    showQuiz,
    answerQuiz
  });
})();
