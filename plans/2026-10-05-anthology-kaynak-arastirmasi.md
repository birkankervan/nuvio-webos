# SRC-02 — Anthology kaynak kaybolması

Araştırma: tek Luna 6/max (`anthlogy_review`). Root: gerçek TV, kanıt ve kod
incelemesi. Önceki performans işleri bu araştırmada genişletilmez.

1. Repo/provider kayıtlarını ve motor durumunu salt okunur denetle. Tamam:
   Anthology kayıtlı/etkin; 41 sağlayıcı, 34 etkin; motor ready/executable.
2. Loading -> error -> removed durumunu kaynak modelinden izle. Tamam:
   source chip başlangıçta eklenir; sonuç gelmezse kırmızı olup 1.6sn sonra silinir.
3. Gerçek film akışında veri hattını ölç. Tamam: IMDb kimlik dönüşümü null;
   provider execution0, plugin groups0; diğer addon128stream. Video açılmadı,
   test sonunda Home ve odak geri getirildi.
4. Paket ayarını kaynakla karşılaştır. Tamam: local.properties yok;
   local.example.properties fallback ve boş TMDB_API_KEY. Kurulu TV'de anahtar
   yalnız boolean ile yok doğrulandı. Hiçbir key/token/özel URL rapora yazılmadı.
5. Tamam: kullanıcının sağladığı TMDB yapılandırması ignored local.properties
   dosyasına kaydedildi (0600). Uygulamanın v3 API anahtarı kullanıldı; v4 okuma
   jetonu alternatif olduğundan ayrıca gerekmedi. Gizli değerler raporlarda yok.
6. Tamam: 39/39 Node, lint, strict paket, buildgraph ve diff kontrolü geçti;
   paket nuvio-lg-145 TV'ye kuruldu. Gerçek TV'de IMDb → TMDB çözümü başarılı;
   Matrix kaynak akışında Anthology loading → success, 15 group callback ve
   toplam 26 stream callback kaydı elde edildi. Bunlar callback toplamıdır,
   benzersiz kaynak sayısı değildir. Dizi/bölüm için ayrı kabul testi yapılmadı.
7. Tamam: aktif profilin ağır görselleri, otomatik fragmanları, isteğe bağlı
   metadata zenginleştirmesi, ek öneriler ve kaynak logoları kapatıldı. CW,
   altyazı ve mevcut native player davranışları korundu. Test wrapper/interval
   temizlendi; player ekranı görüldüğünden açıkça Home'a dönüldü. Son durum
   home, focusConnected=true, birkan marker mevcut. Önceki ayarlar repo dışı
   özel yedekte tutuldu.

Sebep kesin: kurulan paketin boş TMDB ayarı IMDb -> TMDB dönüşümünü engelliyor;
Anthology sağlayıcıları daha çalıştırılmadan boş sonuç alınıyor. Repo/motorun
silindiğine veya son chip diff'inin bunu ürettiğine dair kanıt yok.
Durum: yapılandırma onarımı ve TV movie kabulü tamam; performans ayarları uygulandı.
PATCH-01 gerçek Home güncelleme kabulü ve genel performans işleri ayrı açık.
