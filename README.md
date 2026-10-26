# YDS Vocabulary Platform

CSV veya XML ile kelime listesi yukleyip calisma kartlari, eslestirme ve soru-cevap oyunlariyla pratik yapmaya yarayan basit bir web uygulamasi.

## Ozellikler

- Kategori bazli kelime listesi
- CSV, XML ve TXT dosya aktarimi
- Leitner mantigiyla tekrar kartlari
- Telaffuz destegi
- Eslestirme oyunu
- Coktan secmeli soru-cevap oyunu
- Dört İngilizce seçenekli Cümle Tamamla oyunu (tüm kategorilerde ve günlük programda)
- Tarayicida localStorage ile veri saklama

## Kullanim

`index.html` dosyasini tarayicida acman yeterli.

Dosya yuklerken sutun sirasi:

```text
Kategori, Ingilizce Kelime, Turkce Karsiligi, Ornek Cumle, Cumle Cevirisi, Es Anlamli, Zit Anlamli
```

## Günlük 20 kelime programı

Gün, İstanbul saatine göre belirlenir. 1–6. günlerde her gün 20 yeni kelime açılır; 7. gün yeni kelime eklenmez ve o haftanın kelimeleri tekrar edilir.

Bir günün kartları şu sırayla gelir:

1. Unutulan (Bilemedim/Zorlandım denmiş) kelimeler
2. Bir önceki çalışma gününün yeni kelimeleri
3. Tekrar zamanı gelmiş kelimeler (en çok geciken önce)
4. 7. günde haftanın kalan kelimeleri
5. Bugünün 20 yeni kelimesi

Tekrar kartları günde en çok 60 tanedir; fazlası sonraki güne kalır. Zamanı gelen tekrarlar bu sınıra sığmıyorsa o gün yeni kelime açılmaz ve boşalan yer tekrarlara verilir (günde en çok 80 kart). 7. günde de en çok 80 kart gelir. Öğrenilen kelime 1, 3, 7, 14 ve 30 gün aralıklarla geri gelir. Puanlamalar:

- `Öğrendim`: Yeni kelime 1 günlük aralıkla başlar; zamanı gelmiş bir tekrar bir sonraki basamağa geçer. Zamanı gelmemiş kelimede (örneğin 7. gün tekrarında) takvim değişmez.
- `Zorlandım`: Yeni kelime öğrenilmiş sayılır ve bugün bir kez daha gösterilir; tekrar kelimesi bir basamak düşer ve yarın gelir.
- `Bilemedim`: Kelime sıfırlanır ve bugün tekrar sorulur.

Günlük oyunlarda yanlış yapılan kelime bir basamak düşer, yarın tekrar gelir ve bugün kartla yeniden çalışılır. Eşleştirmede yalnızca seçilen İngilizce kelime hatalı sayılır. Serbest çalışma ve serbest oyunlardaki hatalar, programda öğrenilmiş bir kelimeyi bir basamak düşürüp yarınki tekrara ekler; serbest moddaki doğru cevaplar takvimi değiştirmez.

Kartlar bitince günün oyunları açılır. Oyunlar yalnızca bugünün yeni kelimeleri ve kartlarda zorlandığın kelimelerle oynanır; eski tekrarlar sadece kartla geçilir. Oyunlardaki yanlışlar kelimeyi kart çalışmasına geri ekler. Eş Anlam Bul ve Zıt Anlam Bul isteğe bağlıdır. Kartlar ve zorunlu oyunlar (Test, Eşleştirme, Cümle Tamamla) bitmeden yeni güne geçilmez; hepsi bitince `Sonraki güne geç` ile hemen geçebilirsin. Serbest kategori çalışması ve oyunlar günlük programın tekrar takvimini değiştirmez.

## Öğrendiklerim

Ana ekrandaki panel kelimeleri dört seviyede gösterir: `Yeni` (programa girmedi), `Öğreniliyor` (ilk tekrarını bekliyor), `Pekişiyor` (3, 7 ve 14 günlük basamaklarda) ve `Öğrenildi` (14 günlük tekrarı da bildin, artık 30 günde bir gelir). Öğrenilen kelimeler bir sonraki tekrar tarihleriyle listelenir.

## Zor kelimelerim

Kartlarda ve oyunlarda yapılan her hata kelimenin hata puanını artırır, doğru cevaplar azaltır. Puanı en yüksek 40 kelime ana ekranda `Zor kelimelerim` adlı sanal kategoride toplanır; kartlar ve bütün oyunlar bu listeyle de oynanabilir.

## Kısayollar (masaüstü)

`Boşluk` kartı çevirir, `1` Bilemedim, `2` Zorlandım, `3` Öğrendim, `←`/`→` kartlar arasında gezinir. Oyunlarda şıklar `1`–`4` ile seçilir.

## Elle kelime ekleme

Ana ekrandaki `Kelime ekle` bölümünde `✚ Elle kelime ekle` düğmesi bir form açar: kategori (var olan birini seç veya yeni bir ad yaz), İngilizce kelime, Türkçe karşılık ve isteğe bağlı örnek cümle, çeviri, eş/zıt anlamlılar. `Kaydet, yenisini ekle` formu açık tutar ve kategoriyi korur, böylece arka arkaya kelime girilebilir. Aynı kategoride aynı İngilizce kelime ikinci kez eklenmez. Eklenen kelimeler günlük programa ertesi gün yeni kelime olarak girer.

## Kelime düzenleme

Kart ekranındaki `✎ Düzenle` ile kelimenin İngilizcesini, çevirisini, örnek cümlesini ve eş/zıt anlamlılarını düzeltebilir veya kelimeyi silebilirsin.

## Veriler ve yedekleme

Kelimeler ve bütün ilerleme yalnızca bu tarayıcının `localStorage` alanında saklanır. Tarayıcı verilerini silmek ilerlemeyi de siler. Ana ekrandaki `Yedeği indir` tüm veriyi bir `.json` dosyasına kaydeder; `Yedeği yükle` bu dosyayı aynı veya başka bir cihaza geri yükler (o cihazdaki verinin yerine geçer). Uygulama ayrıca tarayıcıdan veriyi otomatik silmemesi için kalıcı depolama izni ister.

## Proje yapısı

```text
index.html                 # Ekran iskeleti ve sıralı script yüklemesi
src/
  js/
    core/                  # Ayarlar, yardımcılar, kalıcı veri, geçici oturum
    features/
      audio/               # İngilizce seslendirme
      daily/               # Günlük planlama, görünüm, oyunlar, gün değişimi
      decks/               # Kategori listesi, istatistikler, kategori ekleme
      games/               # Eşleştirme, soru-cevap, cümle tamamlama
      import/              # CSV/XML okuma ve yükleme sonucu
      navigation/          # Ana ekran ve oyun ekranı geçişleri
      shortcuts/           # Klavye kısayolları
      study/               # Kartlar ve serbest Leitner çalışması
      words/               # Tek kelime düzenleme ve silme
      backup/              # JSON yedek indirme/yükleme
      progress/            # Öğrendiklerim seviyeleri ve listesi
    bootstrap.js           # Olay bağlantıları ve ilk ekranın açılması
  styles/
    main.css               # Stil giriş noktası ve yükleme sırası
    tokens.css             # Tema renkleri ve ortak tasarım değişkenleri
    base.css               # Sayfa düzeni ve ortak bileşenler
    study.css              # Kart çalışma ekranı
    games.css              # Oyun ekranları ve cevap durumları
    import.css             # Yükleme sonucu penceresi
    tools.css              # Zor kelimeler, düzenleme penceresi, yedekleme, kısayol ipuçları
    responsive.css         # Mobil görünüm ve hareket azaltma tercihleri
tests/
  helpers/                 # HTML'deki sıraya göre uygulama yükleyicisi
  architecture.test.cjs    # Başlangıç, dosya yolları ve modül bağlantıları
  daily.test.cjs           # Günlük program ve cümle tamamlama davranışları
  matching.test.cjs        # Eşleştirme, test ve içe aktarma davranışları
docs/
  architecture.md          # Modül sözleşmeleri ve geliştirme rehberi
```

Uygulama için derleme, sunucu veya `npm install` gerekmez. `index.html` doğrudan
tarayıcıda açılabilir. Mevcut `flashcards_v1` kayıt anahtarı ve veri biçimi korunur.
CSV ayrıştırma için kullanılan PapaParse CDN bağlantısı önceki gibi devam eder.

Yeni geliştirmelere başlamadan önce [mimari rehberini](docs/architecture.md) oku.
