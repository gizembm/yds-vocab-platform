// audio: feature implementation. DOM events are connected in bootstrap.js.
(() => {
  'use strict';

  const { audio } = globalThis.Vocab;

  function speak(t) {
    if (!t || !('speechSynthesis' in window))return alert('Tarayıcın sesli okumayı desteklemiyor.');
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t);
    u.lang = 'en-US';
    u.rate = .9;
    speechSynthesis.speak(u);
  }

  Object.assign(audio, {
    speak
  });
})();
