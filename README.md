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

Kelime listesini yükledikten sonra **Programı başlat** düğmesine bas. Başladığın
gün 7 günlük döngünün ilk günüdür: ilk 6 gün 20 yeni kelime açılır; 7. gün
yeni kelime eklenmeden döngünün tamamı tekrar edilir. Çalışma listesi hafta
boyunca 20, 40, 60, 80, 100 ve 120 kelime olarak birikir. Kaçırdığın günlerin
yeni kelimeleri birikmez. Gün sınırı Türkiye saatine göre hesaplanır.

Kartları çevirip **Bilemedim**, **Zorlandım** veya **Öğrendim** seçeneğini kullan.
Öğrenmediğin kart iki başka karttan sonra yeniden gelir. Günün bütün kartlarını
tamamlayınca aynı kelimelerle **Test**, **Eşleştirme** ve **Cümle Tamamla** turları açılır. Oyunlardaki
yanlışlar yeniden kart çalışmasına döner; doğru oyun cevabı kartı öğrenilmiş saymaz.

**Cümle Tamamla**, dosyadaki örnek İngilizce cümlede hedef kelimenin geçtiği
yerleri boşluk yapar ve dört farklı İngilizce seçenek sunar. Kelimeyi içeren
örnek cümlesi olmayan kartlar bu oyunda sorulmaz. Seçenekler önce seçilen
kategoriden veya günlük kelimelerden alınır; eksik kalırsa diğer kategorilerden
tamamlanır. Bu nedenle tüm listede en az dört farklı İngilizce kelime gerekir.
Günlük tur ilerlemesi kaydedilir; yanlışlar iki başka sorudan sonra yeniden gelir.

Eski döngülerden öğrenilmeyenler her gün gelir. Öğrenilen kelimeler 1, 3, 7, 14
ve 30 günlük aralıklarla tekrar edilir; sonrasında 30 gün arayla devam eder.
Kelime havuzu tükenirse tekrarlar sürer. Sonradan yüklenen kelimeler sonraki
yeni kelime gününde programa alınır. Serbest kategori çalışması ve oyunlar
günlük programdan bağımsız kullanılabilir.

Program, kartlar ve oyun ilerlemesi aynı tarayıcının `localStorage` alanında
saklanır. Sayfayı yenilemek günlük kotayı değiştirmez. Tarayıcı verilerini
silmek bu ilerlemeyi de siler.

Testleri çalıştırmak için (Node.js):

```text
npm test
```

PowerShell, `npm.ps1` çalıştırmayı engelliyorsa `npm.cmd test` kullanabilirsin.
Paket kurulumu gerekmez. Doğrudan Node.js ile çalıştırmak için:

```text
node --test tests/*.test.cjs
```

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
      study/               # Kartlar ve serbest Leitner çalışması
    bootstrap.js           # Olay bağlantıları ve ilk ekranın açılması
  styles/
    main.css               # Stil giriş noktası ve yükleme sırası
    tokens.css             # Tema renkleri ve ortak tasarım değişkenleri
    base.css               # Sayfa düzeni ve ortak bileşenler
    study.css              # Kart çalışma ekranı
    games.css              # Oyun ekranları ve cevap durumları
    import.css             # Yükleme sonucu penceresi
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
