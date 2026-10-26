// importer: feature implementation. DOM events are connected in bootstrap.js.
(() => {
  'use strict';

  const { store, importer, decks } = globalThis.Vocab;
  const { $ } = globalThis.Vocab.utils;

  function addRows(rows) {
    let n = 0, duplicate = 0, invalid = 0;
    const repeated = new Map();
    rows.forEach(r => {
      const [cat, en, tr, ex, exTr, synonyms, antonyms] = r.map(x => (x || '').trim());
      if (!en || !tr) {
        invalid++;
        return;
      }
      const d = cat || 'Genel';
      store.data.decks[d] = store.data.decks[d] || [];
      if (store.hasWord(d, en)) {
        duplicate++;
        const key = JSON.stringify([d, en.toLowerCase()]);
        const entry = repeated.get(key) || {
          en, category : d, count : 0
        };
        entry.count++;
        repeated.set(key, entry);
        return;
      }
      store.data.decks[d].push(store.createCard({ en, tr, ex, exTr, synonyms, antonyms }));
      n++;
    });
    store.save();
    decks.renderDecks();
    importer.showImportResult(n, duplicate, invalid, [...repeated.values()]);
  }

  function showImportResult(added, duplicate, invalid, repeated) {
    $('importTitle').textContent = added ? 'Kelimeler eklendi' : 'Yeni kelime eklenmedi';
    $('importSummary').textContent = added ? 'Kelime listen güncellendi. İyi çalışmalar!' : 'Yüklenen satırların sonucunu aşağıda görebilirsin.';
    $('importAdded').textContent = added;
    $('importDuplicate').textContent = duplicate;
    $('importInvalid').textContent = invalid;
    $('importInvalidNote').hidden = !invalid;
    $('importRepeated').hidden = !duplicate;
    const uniqueWords = new Set(repeated.map(entry => entry.en.toLowerCase())).size;
    $('importRepeatedTitle').textContent = 'Tekrarlı İngilizce kelimeler (' + uniqueWords + ')';
    const list = $('importRepeatedList');
    list.innerHTML = '';
    repeated.forEach(entry => {
      const item = document.createElement('li');
      const word = document.createElement('b');
      word.textContent = entry.en;
      word.lang = 'en';
      const category = document.createElement('span');
      category.className = 'mut';
      category.textContent = entry.category;
      const count = document.createElement('span');
      count.className = 'repeat-count';
      count.textContent = entry.count + ' satır';
      item.append(word, category, count);
      list.append(item);
    });
    const dialog = $('importResult');
    if (!dialog.open)dialog.showModal();
  }

  function parseFile(file) {
    const rd = new FileReader();
    rd.onload = () => {
      const text = String(rd.result).replace(/^\uFEFF/, '');
      if (text.startsWith('PK\u0003\u0004'))return alert('Bu dosya CSV değil, sıkıştırılmış bir dosya (Excel olabilir). Excel’den CSV UTF-8 biçiminde kaydet.');
      let rows;
      if (file.name.toLowerCase().endsWith('.xml')) {
        const doc = new DOMParser().parseFromString(text, 'application/xml');
        if (doc.querySelector('parsererror'))return alert('XML okunamadı.');
        rows = [...doc.documentElement.children].map(el => [...el.children].map(c => c.textContent));
      } else {
        const parsed = Papa.parse(text, {
          skipEmptyLines : 'greedy'
        });
        if (parsed.errors.some(e => e.type === 'Quotes'))return alert('CSV tırnakları hatalı. Dosyayı CSV UTF-8 biçiminde yeniden kaydet.');
        rows = parsed.data.map(row => {
          if (row.length !== 1)return row;
          // Some exports quote an entire CSV record as one cell.
          const nested = Papa.parse(row[0], {
            delimiter : ',', skipEmptyLines : 'greedy'
          });
          return !nested.errors.length && nested.data.length === 1 && nested.data[0].length === 7 ? nested.data[0] : row;
        });
      }
      if (rows.length && /kategori|categor/i.test(rows[0][0] || ''))rows.shift();
      // başlık satırı
      importer.addRows(rows);
    };
    rd.readAsText(file, 'UTF-8');
  }

  Object.assign(importer, {
    addRows,
    showImportResult,
    parseFile
  });
})();
