(() => {
  'use strict';

  const app = globalThis.Vocab;
  app.utils.$ = id => document.getElementById(id);
  app.utils.dstr = time => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(time);
  app.utils.shuffle = items => items
    .map(value => [Math.random(), value])
    .sort((a, b) => a[0] - b[0])
    .map(item => item[1]);
})();
