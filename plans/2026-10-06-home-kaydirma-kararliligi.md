# SCROLL-01 — Home kaydırma kararlılığı

6 Ekim 2026; güncel öncelik. Nihai mimari planı ve iş panosu geçerlidir.

- scroll_fix (gpt-6-luna/max): `homeDataWindow.js` ve `homeDataWindowRuntime.test.mjs`.
- scroll_nav_review (gpt-6-luna/max): salt okunur callers/geometry/Back/pagination review.
- root: DOM fixture, entegrasyon, MD, test/lint/strict paket ve gerçek TV kabulü.

Kök kanıtı: dirtyRows metadata invalidation ölçüleri de siliyor. Gerçek kurulu
Home üç geçici metadata update/17 örnekte height/offset/scroll/görsel top max29px
sapması verdi; renderer/shell/focus/track korundu. İzole DOM fixture ölçülmüş
350px kart/76.4px header ile commit anında başarısız oldu. Probe finally temiz.

Uygulama: metadata commit sırasında ölçülmüş geometriyi koru; gerçek layout,
loading/kart biçimi ve collection shape değişimi için ölçüyü güvenle yenile.
Koleksiyon küçülmesi ve bilinmeyen güncelleme güvenliği korunacak. Yeni dependency yok.

Kabul: commit, ilk sync ve ölçüm frame'inde anchor/top/scroll kararlı. Node
regression ve gerçek TV DOM fixture; lint, strict paket ve build graph sonrası
TV kurulum. Kurulu Home aynı üç metadata güncellemesi; sentetik kumanda gezinme,
detail/Back ve gerçek katalog sayfalama. Fiziksel kumanda kontrolü ayrı kabul.

Sonraki sıra: detail/kaynak ilk görünüm ve cancellation; rapor performans/bellek
bulguları; Library/Classic/Grid/collection pencereleme; cold/remote/video/uzun
bellek TV-01 kabulü; sonra IPTV Xtream+TV/QR hesap girişi, M3U, EPG.
Auth/profil/addon/native player ve mevcut tercihler korunur. Marker eklenmez.

## Dar kabul sonucu

İki Luna/max tamam, root review bulguları aynı ajana revize ettirildi.42Node/lint/
strictpaket/buildgraph/diff geçti;133TVfixture. Final1.2.3 TVde metadata3repeat
max29→0px; shell/focus/track korunur. Sentetik sağ/sol, actual detailBack ve actual
page40→58/nextSkip60 geçti. Profil/ayarlar korundu; probe temiz. Fiziksel kumanda
ve geniş TV-01 açık; tek warm ölçüm18.8ms inputp95/50ms framep95 hedefleri geçmedi.
