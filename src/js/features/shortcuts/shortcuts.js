// shortcuts: keyboard control for cards and multiple-choice games. Bound in bootstrap.js.
(() => {
  'use strict';

  const { shortcuts, study } = globalThis.Vocab;
  const { $ } = globalThis.Vocab.utils;

  const RATINGS = { 1: 'miss', 2: 'hard', 3: 'know' };
  const visible = id => {
    const element = $(id);
    return !!element && !element.hidden;
  };

  function typing(target) {
    const tag = target?.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!target?.isContentEditable;
  }

  function handleKey(event) {
    if (event.ctrlKey || event.metaKey || event.altKey || typing(event.target))return false;
    if (document.querySelector?.('dialog[open]'))return false;
    const key = event.key;

    if (visible('study') && visible('game')) {
      // Space always flips; Enter keeps its normal meaning on a focused button.
      if (key === ' ' || key === 'Enter' && event.target?.tagName !== 'BUTTON') {
        event.preventDefault();
        study.flipCard();
        return true;
      }
      if (RATINGS[key] && visible('rate')) {
        event.preventDefault();
        study.rateStudy({ target: { dataset: { q: RATINGS[key] } } });
        return true;
      }
      if (key === 'ArrowLeft' || key === 'ArrowRight') {
        event.preventDefault();
        study.moveCard(key === 'ArrowLeft' ? -1 : 1);
        return true;
      }
    }

    if (visible('play') && visible('quizBox') && /^[1-5]$/.test(key)) {
      const button = $('quizChoices').children[Number(key) - 1];
      if (button && !button.disabled && button.onclick) {
        event.preventDefault();
        button.onclick();
        return true;
      }
    }
    return false;
  }

  Object.assign(shortcuts, {
    handleKey
  });
})();
