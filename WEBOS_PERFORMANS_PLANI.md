# webOS performans planı — güncel giriş noktası

5 Ekim 2026. Bu dosya plan dizinidir; tek güncel uygulama planı aşağıdadır.

- [Öncelikli Home kaydırma kararlılığı](plans/2026-10-06-home-kaydirma-kararliligi.md)
- [Nihai mimari ve aşamalar](plans/2026-10-05-webos-nihai-mimari.md)
- [Modern Home bölgesel güncelleme](plans/2026-10-05-home-bolgesel-guncelleme.md)
- [IPTV planı](plans/2026-10-06-iptv-plani.md) — planlama şimdi, uygulama TV-01 kabulünden sonra
- [İş takibi ve ajan sahipliği](WEBOS_IS_TAKIBI.md)
- [Son kontrol noktası ve devam bilgileri](WEBOS_DEVAM_NOTLARI.md)
- [Bulgular, önceki değişiklikler ve ölçüm sınırları](WEBOS_DERIN_INCELEME.md)
- [Doğrulama ve TV senaryoları](WEBOS_TEST_PLANI.md)
- [Tarihsel ara optimizasyon planı](plans/2026-10-05-ara-optimizasyon-plani.md)

## Mevcut durum

TV'deki Modern Home veriden görünür pencere oluşturur. Bölgesel güncelleme ve
tekrarlı DOM sorgu azaltması kurulu; 1.2.3, Anthology ve kullanıcı tercihleri korunur.

6 Ekim SCROLL-01 dar kabulü tamam: metadata güncellemesindeki measured→estimate
sapması düzeltildi. İki Luna/max ajan + root review;42 Node/lint/strictpaket/buildgraph,
133 izole TV DOM kontrolü geçti. Final paket TVye kuruldu; aynı metadata3repeat
probe'da scroll/geometri sapması29px→0px. Sentetik gezinme, gerçek detailBack ve
katalog pagination passed; fiziksel kumanda ayrı kabul bekler.

Geniş performans kabulü açık: tek warm sentetik sample inputp9518.8ms ve
framep9550ms hedefleri karşılamadı. Detail/kaynak yükleme, ayar/player/cache/leak,
Library/Classic/Grid/collections ve cold/video/uzun bellek kontrolü sıradadır.

IPTV performans kabulünden sonra ele alınır. Yeni framework/dependency gerekmiyor.
