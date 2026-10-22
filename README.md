# YDS Vocabulary Platform

CSV veya XML ile kelime listesi yukleyip calisma kartlari, eslestirme ve soru-cevap oyunlariyla pratik yapmaya yarayan basit bir web uygulamasi.

## Ozellikler

- Kategori bazli kelime listesi
- CSV, XML ve TXT dosya aktarimi
- Leitner mantigiyla tekrar kartlari
- Telaffuz destegi
- Eslestirme oyunu
- Coktan secmeli soru-cevap oyunu
- DÃ¶rt Ä°ngilizce seÃ§enekli CÃ¼mle Tamamla oyunu (tÃ¼m kategorilerde ve gÃ¼nlÃ¼k programda)
- Tarayicida localStorage ile veri saklama

## Kullanim

`index.html` dosyasini tarayicida acman yeterli.

Dosya yuklerken sutun sirasi:

```text
Kategori, Ingilizce Kelime, Turkce Karsiligi, Ornek Cumle, Cumle Cevirisi, Es Anlamli, Zit Anlamli
```

## Günlük 20 kelime programı

Program, her gün 20 yeni kelime açar; yedinci gün yeni kelime eklemeden o haftanın kelimelerini tekrar eder. Gün, İstanbul saatine göre belirlenir. Günün kart çalışması ve uygun oyunları (Test, Eşleştirme, Cümle Tamamla, Eş Anlam Bul, Zıt Anlam Bul) tamamlanmadan yeni güne geçilmez. Gün değiştiğinde tamamlanmamış çalışma aynı oturumdan devam eder. Tüm görevler bitince `Sonraki güne geç` düğmesiyle yeni güne hemen geçebilir veya mevcut ekranda kalabilirsin. Oyunlar yalnızca o turda bulunan ve ilgili alanı dolu kelimeler için sunulur; günlük oyun ilerlemesi yenileme sonrasında korunur.

Kartlarda Bilemedim, Zorlandım veya Öğrendim seçenekleri kullanılır. Oyunlardaki yanlışlar kelimeyi kart çalışmasına geri ekler. Sonraki günler yeni kelime kotası dolana kadar birikir; öğrenilmemiş kelimeler ve zamanı gelen tekrarlar da programa dahil edilir. Serbest kategori çalışması ve oyunlar günlük programdan bağımsızdır.

Program, kartlar ve oyun ilerlemesi aynı tarayıcının `localStorage` alanında saklanır. Tarayıcı verilerini silmek bu ilerlemeyi de siler.
## Proje yapÄ±sÄ±

```text
index.html                 # Ekran iskeleti ve sÄ±ralÄ± script yÃ¼klemesi
src/
  js/
    core/                  # Ayarlar, yardÄ±mcÄ±lar, kalÄ±cÄ± veri, geÃ§ici oturum
    features/
      audio/               # Ä°ngilizce seslendirme
      daily/               # GÃ¼nlÃ¼k planlama, gÃ¶rÃ¼nÃ¼m, oyunlar, gÃ¼n deÄŸiÅŸimi
      decks/               # Kategori listesi, istatistikler, kategori ekleme
      games/               # EÅŸleÅŸtirme, soru-cevap, cÃ¼mle tamamlama
      import/              # CSV/XML okuma ve yÃ¼kleme sonucu
      navigation/          # Ana ekran ve oyun ekranÄ± geÃ§iÅŸleri
      study/               # Kartlar ve serbest Leitner Ã§alÄ±ÅŸmasÄ±
    bootstrap.js           # Olay baÄŸlantÄ±larÄ± ve ilk ekranÄ±n aÃ§Ä±lmasÄ±
  styles/
    main.css               # Stil giriÅŸ noktasÄ± ve yÃ¼kleme sÄ±rasÄ±
    tokens.css             # Tema renkleri ve ortak tasarÄ±m deÄŸiÅŸkenleri
    base.css               # Sayfa dÃ¼zeni ve ortak bileÅŸenler
    study.css              # Kart Ã§alÄ±ÅŸma ekranÄ±
    games.css              # Oyun ekranlarÄ± ve cevap durumlarÄ±
    import.css             # YÃ¼kleme sonucu penceresi
    responsive.css         # Mobil gÃ¶rÃ¼nÃ¼m ve hareket azaltma tercihleri
tests/
  helpers/                 # HTML'deki sÄ±raya gÃ¶re uygulama yÃ¼kleyicisi
  architecture.test.cjs    # BaÅŸlangÄ±Ã§, dosya yollarÄ± ve modÃ¼l baÄŸlantÄ±larÄ±
  daily.test.cjs           # GÃ¼nlÃ¼k program ve cÃ¼mle tamamlama davranÄ±ÅŸlarÄ±
  matching.test.cjs        # EÅŸleÅŸtirme, test ve iÃ§e aktarma davranÄ±ÅŸlarÄ±
docs/
  architecture.md          # ModÃ¼l sÃ¶zleÅŸmeleri ve geliÅŸtirme rehberi
```

Uygulama iÃ§in derleme, sunucu veya `npm install` gerekmez. `index.html` doÄŸrudan
tarayÄ±cÄ±da aÃ§Ä±labilir. Mevcut `flashcards_v1` kayÄ±t anahtarÄ± ve veri biÃ§imi korunur.
CSV ayrÄ±ÅŸtÄ±rma iÃ§in kullanÄ±lan PapaParse CDN baÄŸlantÄ±sÄ± Ã¶nceki gibi devam eder.

Yeni geliÅŸtirmelere baÅŸlamadan Ã¶nce [mimari rehberini](docs/architecture.md) oku.
