// backup: download/restore all progress as a JSON file. DOM events are connected in bootstrap.js.
(() => {
  'use strict';

  const { store, navigation, daily, backup } = globalThis.Vocab;
  const { $, dstr } = globalThis.Vocab.utils;

  const APP_ID = 'yds-vocab';
  const REMIND_AFTER_DAYS = 7;

  function validate(data) {
    if (!data || typeof data !== 'object' || !data.decks || typeof data.decks !== 'object' || Array.isArray(data.decks))
      return 'Bu dosya bir kelime yedeği değil.';
    for (const [name, cards] of Object.entries(data.decks)) {
      if (!Array.isArray(cards))return '"' + name + '" kategorisi bozuk.';
      if (cards.some(card => !card || typeof card.id !== 'string' || typeof card.en !== 'string' || typeof card.tr !== 'string'))
        return '"' + name + '" kategorisinde eksik bilgili kelime var.';
    }
    return null;
  }

  // Accepts the wrapped export format and a raw copy of the saved data.
  function parseBackup(text) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { error: 'Dosya okunamadı. Uygulamadan indirilen .json yedeğini seç.' };
    }
    const data = parsed && parsed.app === APP_ID ? parsed.data : parsed;
    const error = validate(data);
    return error ? { error } : { data };
  }

  function exportBackup() {
    store.data.lastBackup = dstr(Date.now());
    store.save();
    const payload = { app: APP_ID, version: 1, exportedAt: new Date().toISOString(), data: store.data };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'yds-kelime-yedek-' + store.data.lastBackup + '.json';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    backup.renderBackup();
  }

  function restoreBackup(data) {
    store.data = Object.assign({ decks: {}, pts: 0, streak: 0, last: '', today: 0, cur: null }, data);
    store.data.lastView = { type: 'home' };
    store.save();
    navigation.showHome();
  }

  function importBackup(file) {
    const reader = new FileReader();
    reader.onload = () => {
      const { data, error } = backup.parseBackup(String(reader.result));
      if (error)return alert(error);
      const count = Object.values(data.decks).flat().length;
      if (!confirm('Yedekte ' + count + ' kelime var. Bu cihazdaki tüm kelimeler ve ilerleme yedekteki ile değiştirilsin mi?'))return;
      backup.restoreBackup(data);
    };
    reader.readAsText(file, 'UTF-8');
  }

  function renderBackup() {
    const status = $('backupStatus');
    if (!status)return;
    const last = store.data.lastBackup;
    const days = last ? Math.round(daily.dateNumber(dstr(Date.now())) - daily.dateNumber(last)) : null;
    status.textContent = days === null ? 'Henüz yedek almadın.'
      : days === 0 ? 'Son yedek: bugün.' : 'Son yedek: ' + days + ' gün önce.';
    status.classList.toggle('warn', days === null ? store.allCards().length > 0 : days >= REMIND_AFTER_DAYS);
  }

  // Asks the browser not to evict this site's storage automatically (best effort).
  function requestPersistence() {
    const storage = typeof navigator !== 'undefined' ? navigator.storage : null;
    if (!storage?.persist)return;
    storage.persisted().then(done => done || storage.persist()).catch(() => {});
  }

  Object.assign(backup, {
    validate,
    parseBackup,
    exportBackup,
    restoreBackup,
    importBackup,
    renderBackup,
    requestPersistence
  });
})();
