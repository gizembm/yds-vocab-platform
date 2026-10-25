// daily-view: feature implementation. DOM events are connected in bootstrap.js.
(() => {
  'use strict';

  const { store, daily } = globalThis.Vocab;
  const { $ } = globalThis.Vocab.utils;

  function renderDailyActions(target) {
    const box = $(target), s = store.data.program.session;
    box.innerHTML = '';
    if (!s.ids.length) {
      box.textContent = 'Açılan kelime yok. Yeni kelime yükleyebilir veya sonraki çalışma gününü bekleyebilirsin.';
      return;
    }
    if (s.pending.length) {
      box.textContent = s.pending.length + ' kelime için kart çalışması gerekiyor.';
      return;
    }
    const labels = { quiz : 'Test', match : 'E\u015fle\u015ftirme', sentence : 'C\u00fcmle Tamamla', synonyms : 'E\u015f Anlam Bul', antonyms : 'Z\u0131t Anlam Bul' };
    const required = daily.requiredGames(), optional = daily.optionalGames();
    for (const mode of [...required, ...optional]) {
      const button = document.createElement('button');
      const isOptional = optional.includes(mode);
      button.className = isOptional ? 'optional-game' : '';
      button.textContent = labels[mode] + (isOptional ? ' (isteğe bağlı)' : '') + (s[mode].pending?.length === 0 ? ' ✓' : '');
      button.onclick = () => daily.startDailyGame(mode);
      box.append(button);
    }
    if (daily.gamesComplete(s)) {
      const next = document.createElement('button');
      next.textContent = 'Sonraki güne geç';
      next.onclick = () => daily.advanceDailyDay();
      box.append(next);
    }
    const note = document.createElement('p');
    note.className = 'hint';
    note.textContent = required.length
      ? 'Oyunlar bugünün yeni kelimeleri ve kartlarda zorlandığın kelimelerle oynanır. Eş ve zıt anlam oyunları isteğe bağlıdır; yapmasan da sonraki güne geçebilirsin.'
      : 'Bugün oyun gerektiren yeni veya hatalı kelime yok.';
    box.append(note);
  }

  function renderDaily() {
    const s = daily.ensureDaily();
    $('programStart').hidden = !!s;
    $('programStart').disabled = !store.allCards().length;
    $('programStudy').hidden = !s;
    $('programProgress').hidden = !s;
    if (!s) {
      $('programSummary').textContent = '6 gün 20 yeni kelime, 7. gün genel tekrar. Başladığın gün döngünün ilk günüdür.';
      $('programActions').innerHTML = '';
      return;
    }
    const day = (store.data.program.dayIndex || 0)%7 + 1;
    const note = day === 7 ? 'Genel tekrar günü' : s.backlog ? 'Tekrarlar birikti, bugün yeni kelime yok' : '';
    const chips = [
      (daily.cycleOf() + 1) + '. hafta, ' + day + '. gün',
      s.newIds.length + ' yeni',
      (s.ids.length - s.newIds.length) + ' tekrar',
      s.pending.length ? s.pending.length + ' kart kaldı' : 'Kartlar bitti'
    ];
    const summary = $('programSummary');
    summary.textContent = '';
    for (const text of note ? [note, ...chips] : chips) {
      const chip = document.createElement('span');
      chip.className = 'chip' + (text === note ? ' chip-note' : '');
      chip.textContent = text;
      summary.append(chip);
    }
    const total = s.ids.length, percent = total ? Math.round(100 * (total - s.pending.length) / total) : 0;
    $('programProgress').setAttribute('aria-valuenow', String(percent));
    $('programProgress').setAttribute('style', '--p:' + percent + '%');
    $('programStudy').textContent = s.pending.length ? 'Günlük çalışmaya devam et' : 'Günlük kartlar tamamlandı';
    daily.renderDailyActions('programActions');
  }

  Object.assign(daily, {
    renderDailyActions,
    renderDaily
  });
})();
