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
    const labels = { quiz : 'Test', match : 'E\u015fle\u015ftirme', sentence : 'C\u00fcmle Tamamla', synonyms : 'E\u015f Anlam Bul', antonyms : 'Z\u0131t Anlam Bul' };
    for (const mode of s.requiredGames || ['quiz', 'match']) {
      const label = labels[mode];
      const button = document.createElement('button');
      button.textContent = label + (s[mode].pending?.length === 0 ? ' ✓' : '');
      button.onclick = () => daily.startDailyGame(mode);
      button.disabled = mode === 'sentence' ? !sentence.sentenceCards(daily.dailyCards()).length || new Set(store.allCards().map(c => sentence.englishKey(c.en))).size < 4
      : mode === 'match' ? s.ids.length < 2 : new Set(daily.dailyCards().map(c => c.tr)).size < 2;
      if (mode === 'synonyms' || mode === 'antonyms')button.disabled = !daily.dailyCards().some(c => String(c[mode] || '').trim());
      box.append(button);
    }
    const complete = !s.pending.length && (s.requiredGames || []).every(mode => s[mode]?.pending?.length === 0);
    if (complete) {
      const next = document.createElement('button');
      next.textContent = 'Sonraki güne geç';
      next.onclick = () => daily.advanceDailyDay();
      box.append(next);
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
    const day = (store.data.program.dayIndex || 0)%7 + 1;
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
