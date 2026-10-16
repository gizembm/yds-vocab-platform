// daily-view: feature implementation. DOM events are connected in bootstrap.js.
(() => {
  'use strict';

  const { store, sentence, daily } = globalThis.Vocab;
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
    for (const [mode, label] of [['quiz', 'Test'], ['match', 'Eşleştirme'], ['sentence', 'Cümle Tamamla']]) {
      const button = document.createElement('button');
      button.textContent = label + (s[mode].pending?.length === 0 ? ' ✓' : '');
      button.onclick = () => daily.startDailyGame(mode);
      button.disabled = mode === 'sentence' ? !sentence.sentenceCards(daily.dailyCards()).length || new Set(store.allCards().map(c => sentence.englishKey(c.en))).size < 4
      : mode === 'match' ? s.ids.length < 2 : new Set(daily.dailyCards().map(c => c.tr)).size < 2;
      box.append(button);
    }
    const note = document.createElement('p');
    note.className = 'hint';
    note.textContent = 'Test için iki farklı anlam, eşleştirme için iki kelime gerekir. Cümle Tamamla için kelimeyi içeren örnek cümle ve listende dört farklı İngilizce kelime gerekir.';
    box.append(note);
  }

  function renderDaily() {
    const s = daily.ensureDaily();
    $('programStart').hidden = !!s;
    $('programStart').disabled = !store.allCards().length;
    $('programStudy').hidden = !s;
    if (!s) {
      $('programSummary').textContent = '6 gün 20 yeni kelime, 7. gün genel tekrar. Başladığın gün döngünün ilk günüdür.';
      $('programActions').innerHTML = '';
      return;
    }
    const day = (daily.dateNumber(s.date) - daily.dateNumber(store.data.program.start))%7 + 1;
    $('programSummary').textContent = (daily.cycleOf(s.date) + 1) + '. döngü · ' + day + '. gün' + (day === 7 ? ' · Genel tekrar' : '') +
    ' · ' + s.newIds.length + ' yeni · ' + s.ids.length + ' toplam · ' + s.done.length + ' tamamlanan · ' + s.pending.length + ' kalan';
    $('programStudy').textContent = s.pending.length ? 'Günlük çalışmaya devam et' : 'Günlük kartlar tamamlandı';
    daily.renderDailyActions('programActions');
  }

  Object.assign(daily, {
    renderDailyActions,
    renderDaily
  });
})();
