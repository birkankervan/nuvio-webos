# Uncommitted performans değişikliklerinin incelemesi (REVIEW-02)

**Tarih:** 5 Ekim 2026

**Kapsam:** HEAD (`358d08c`) üzerindeki commit edilmemiş değişiklikler.

- 49 dosyada değişiklik: +449 / −351 satır.
- Yaklaşık 3000 satır yeni dosya: Home veri penceresi, keyedDomUpdate, lazyRoute, boundedCache, testler ve scriptler.

**Yöntem:** Üç read-only Sonnet 5.5 ajanı her değişikliği iki soruyla inceledi:

1. HEAD'de gerçekten bir sorun var mı (gerekçe)?
2. Uygulama doğru mu?

Ajanların alanları:

| Ajan | Kapsam |
| --- | --- |
| rev2_home | Home |
| rev2_nav | Router, build ve paketleme |
| rev2_load | Stream, Detail, Player ve cache |

Root, kritik bulguları kodda yeniden kontrol etti; doğrulananlar ✔ ile işaretli. Kaynak kodda değişiklik yapılmadı.

**Önemli sınır:** Bu inceleme kod okuma ve unit test düzeyindedir. TV'de performans veya A/B ölçümü yapılmadı. AGENTS.md gereği bu sonuçlar runtime kabulü sayılmaz.

## Özet karar

| Sonuç | Değişiklik sayısı |
| --- | --- |
| KEEP (doğru, gerekçesi geçerli) | 20 |
| KEEP + küçük FIX | 7 |
| Gerekçesiz; justify veya REVERT | 1 |
| REVERT | 0 |

Testler:

| Test grubu | Sonuç |
| --- | --- |
| Home | 30/30 geçti |
| Navigation | 4/4 geçti |
| Stream, Detail ve cache | 5/5 geçti |

Lint temiz. `keyedDomUpdate.js` için hiç test yok.

Genel değerlendirme: Yapılan değişikliklerin büyük çoğunluğu HEAD'deki gerçek sorunları hedefliyor ve uygulama doğru. Asıl riskler iki yerde toplanıyor:

- Lazy route geçişinin hata ve yarış durumları.
- Home'da ilk render'ın iki kez yapılması ve See All verisinin bayatlaması.

## 1. Router, build ve bootstrap

| # | Değişiklik | Gerekçe geçerli mi? | Uygulama | Karar |
| --- | --- | --- | --- | --- |
| N1 | ESM chunk build ve lazy route; eski motorlar için IIFE fallback (build.mjs, lazyRoute.js, router.js, load-app.js) | Kısmen. HEAD tüm ekranları tek bir IIFE'ye statik import ediyordu, bu yüzden açılış parse maliyeti gerçek. Ancak TV'deki kazanç ölçülmedi. | IIFE bundle'a `import(` veya ESM sızıntısı yok (0 adet). Paket 101 chunk'ın tamamını içeriyor. Eski webOS (Chromium 38–53) `noModule` kontrolüyle IIFE alıyor. | KEEP + FIX |
| N1a ✔ | `load-app.js` modül script'i yüklenemezse `app.bundle.js`'e geri dönmüyor; yalnız `scriptFailed` çağırıyor. | — | Risk: modül yolu açılmazsa uygulama hiç açılmaz. | FIX: `onerror` içinde `app.bundle.js` enjekte et. |
| N1b | `file://` altında `<script type=module>` desteği yalnız QR dynamic-import testiyle dolaylı kanıtlanmış. | — | Doğrulanmadı. | Gerçek TV'de kurulu pakette doğrula. |
| N2 ✔ | Navigate sırasında lazy load ve `navigationRequestId` yarış koruması | Evet. Geç gelen bir ekran yeni navigasyonun üstüne yazılabiliyordu. | **Bug:** `Back()` (routerMethods-03:74) ekranı doğrudan `mount` ediyor ve id'yi artırmıyor. Chunk yüklenirken Back'e basılırsa geç gelen navigate devam eder, dönülen ekranı cleanup eder ve lazy ekranı üstüne açar. Pencere yalnız ilk (soğuk) chunk yüklemesi kadar. | FIX: Back ve popstate yollarında id'yi artır, ya da await sonrası `current`'ı kontrol et. |
| N2a | Chunk yükleme hatası | — | Yalnız `console.error` var. Kullanıcı tuşun çalışmadığını sanır. Boot sırasında lazy route'a dönülürse boot guard son aşamada takılı kalır. | FIX: toast veya `bootGuard.scriptFailed` ekle. |
| N3 | RouteStateStore LRU 12 | Evet. HEAD'de Map sınırsızdı. | Doğru; test eviction ve recency'yi doğruluyor. Yan etki: uzun gezintide Home snapshot'ı düşebilir ve Back'te odak kaybolur. | KEEP. Limiti 24 yapmak veya Home'u pinlemek düşünülebilir. |
| N4 | `preloadStreamBadgeImages` app.js'den çıkarıldı | Evet. Statik import stream UI'sını ilk grafiğe çekiyordu. | Doğru. Badge'ler artık ilk Stream açılışında yüklenir; küçük bir ilk kullanım takılması olabilir. | KEEP |
| N5 | `tv-runtime` class'ı (app.js) | Evet; yeni detail loading CSS'ine kapsam sağlıyor. | Doğru | KEEP |
| N6 | build, package ve sync-wrapper scriptleri, check-performance-build | Evet | Doğru. Check yalnız metin varlığına bakıyor, fallback'i çalıştırmıyor. | KEEP |
| N7 | index.html'den `?v=` kaldırıldı | — | Paketli TV'yi etkilemez. Hosted web build'de cache sorunu olabilir. | KEEP (TV için) |

## 2. Home

| # | Değişiklik | Gerekçe geçerli mi? | Uygulama | Karar |
| --- | --- | --- | --- | --- |
| H1 | Modern veri penceresi renderer'ı: homeDataWindow, homeVirtualRows, homeLogicalFocus, homeRowMetrics, homeVirtualWindow | Evet. HEAD 31 satırı ve 462+ kartı tek ağaçta tutuyordu. | Cleanup ve destroy sızıntısız. Pagination token, renderer ve route kontrolleri var. Boş satır ve kaldırılmış odak durumları test edilmiş. | KEEP + FIX |
| H1a ✔ | İlk render iki kez çiziliyor. render() innerHTML'i yazar, ardından `attach→sync` aynı content için keyedDomUpdate çağırır. Bu content `mountedShells`'te kayıtlı olmadığından kod `container.innerHTML = markup` ile tam yeniden yazmaya düşer (keyedDomUpdate.js:183). | — | Kartlar her tam render'da iki kez oluşturuluyor. Sorun yalnız perf. | FIX: attach'ta `mountedShells` ve `remember` seed et. |
| H1b | `catalogSeeAllMap` yalnız tam render'da yenileniyor. | — | Bölgesel güncelleme ve pagination sonrası See All eski initialItems/nextSkip ile açılabilir. | FIX: commitModernHomeDataUpdate içinde map'i yenile. |
| H1c | Track scroll başına tüm pencere markup'ı yeniden üretilip diff'leniyor. | — | rAF ile birleştiriliyor ama TV'de ölçülmedi. Bkz. genel inceleme R-05. | Ölç |
| H1d | Modern Home'da Back artık her zaman tam render yapıyor (cleanup homeDataWindow'u null'luyor). | — | Pencereli olduğu için ucuz. Bug değil, tasarım sonucu. | Not |
| H2 | homeDomUpdate'in keyedDomUpdate.js'e taşınması | Evet; Stream ile paylaşım için. | Taşıma neredeyse birebir. Text node `remember` eklenmesi gerçek bir duplicate-text bug'ını düzeltiyor. `components/`, `screens/home`'dan import ediyor (katman tersliği). Test yok. | KEEP. Minimal DOM testi ekle. |
| H3 | homeRowVirtualizer (classic layout, cached detached DOM) | Kısmen. Dokümanlar da bunun nihai çözüm olmadığını kabul ediyor. | `getNavigationRowNodes` artık `isConnected` filtresi yapmıyor. Bilinen caller'lar yamanmış, ama yamalanmamış başka bir caller'ın detached node'a odaklanma riski var. | KEEP (yalnız classic). Nihai sanallaştırma diye sunma. |
| H4 | requestBackgroundRender ve dirty-set ile bölgesel güncelleme | Evet. HEAD her arka plan olayında tam render yapıyordu. | Bilinmeyen değişiklik tam render'a düşüyor (güvenli). Bekleyen focus, restore veya hold varsa tam render'a dönülüyor (muhafazakâr). | KEEP |
| H5 | 250 ms input settle (kısıtlı olmayan TV) | Evet | `lastInputAt > 0` koruması doğru. | KEEP |
| H6 | getDirectionalRepeatThrottleMs | Evet. HEAD'de `!isBrowser` early return yüzünden TV branch'ı ulaşılamazdı. | Doğru. Davranış değişikliği: legacy TV'de 120 ms, kısıtlı TV'de 100 ms tuş tekrarı. TV'de hissi test edilmeli. | KEEP + TV A/B |
| H7 | Detail ekran modülü idle prefetch | Evet | 1,5 sn debounce, token ve route korumalı, cleanup'ta temizleniyor. | KEEP |
| H8 ✔ | `canPreloadHeroDuringVerticalScroll` kaldırıldı (methods-10) | **Dokümanlarda gerekçe yok.** | HEAD'de kısıtlı olmayan TV, dikey scroll sırasında hero'yu önceden yüklüyordu. Artık her zaman settle bekleniyor. Bu, hero gecikmesini scroll akıcılığıyla takas ediyor ama ölçülmedi. | Gerekçe yaz ve TV'de ölç, ya da HEAD koşulunu geri getir. |
| H9 | Truncation resize listener sızıntı düzeltmesi | Evet. HEAD'de anonim listener hiç kaldırılmıyordu. | Doğru. Not: Folder ekranı aynı metodu kullanıyor ve kendi cleanup'ında kaldırmıyor (genel inceleme M-05). | KEEP |
| H10 | Lazy image kuyruğunda Map ile dedupe | Evet. Önceki findIndex O(n²) idi. | Doğru | KEEP |
| H11 | Hero DOM'unun registerHomeDomNodes ile kaydı | Evet; keyed diff snapshot'ı tutarlı kalıyor. | Doğru | KEEP |
| H12 | HOME_PERF_DEBUG log kapısı; route state'e index/navCol eklenmesi | Evet | Doğru | KEEP |

## 3. Stream, Detail, Player ve cache

| # | Değişiklik | Gerekçe geçerli mi? | Uygulama | Karar |
| --- | --- | --- | --- | --- |
| L1 | BoundedCache: meta ve TMDB cache'leri (LOAD-03) | Evet. HEAD'deki Map'ler hiç evict etmiyordu. | LRU doğru. In-flight dedup map'leri düz Map olarak kaldı, dedup bozulmadı. Auth/addon anahtarları değişmedi. Test iddiayı doğruluyor. | KEEP |
| L2 | Stream keyed DOM render | Evet. HEAD her chunk'ta innerHTML yazıyor ve odağı sıfırlıyordu. | Odaklı dal anchor olarak korunuyor ve duplicate key kuyruğu var. Risk: keyedDomUpdate Home'a göre yazılmış (`.home-content-card` koruma listesi). Incremental yolu kapsayan unit test yok. | KEEP. Geç chunk sonrası odağı TV'de doğrula. |
| L3 | TV'de pencere eşiği 24 | Kısmen; mantıklı ama ölçülmedi. | Doğru. Artık 25–40 kaynaklı gerçek listeler de pencere yolunda. | KEEP. TV'de odak ve scroll doğrula. |
| L4 | İlk chunk hemen, sonrakiler 120 ms'de birleştiriliyor; load başına token | Evet | Doğru. Token flush'ta kontrol ediliyor, timer yeni load'da ve cleanup'ta temizleniyor. Eski `.catch` kalktığı için displayChunkGroups içindeki bir throw artık yayılıyor. | KEEP. try/catch ekle. |
| L5 | Debrid timer handle'ının temizlenmesi | Evet. HEAD handle'ı kaybediyordu. | Doğru | KEEP |
| L6 | Stream cleanup'ta büyük verinin bırakılması | Evet | Router state'i cleanup'tan önce yakalıyor. Tüm `this.params` erişimleri `?.` ile korunuyor. | KEEP |
| L7 | Detail cleanup: generation invalidate ve meta/episodes release | Evet | Sıra doğru. Risk: token koruması olmayan bir async callback'te `this.meta.x` çağrılırsa throw olur. Bu durum yalnız loadDetail yolunda kontrol edildi. | KEEP. Detail'de korumasız `this.meta.` kullanımlarını grep et. |
| L8 ✔ | Stale sections rAF iptali (LOAD-02) | Evet | Erken return `_sectionsUpdateRaf`'ı sıfırlamıyor (methods-08:236). Token değişip detail mount'lu kalırsa sonraki section güncellemeleri bloklanır. Cleanup sıfırladığı için nadir. | KEEP + FIX: return'den önce sıfırla. |
| L9 | Detail loadDetail erteleme (shell önce paint edilir) | Kısmen; yaklaşık 1 frame gecikme getiriyor. | Yeni async boşlukların hepsi token kontrollü. fetchTmdbCastFallback sonrasındaki token kontrolü iyi bir ek. | KEEP |
| L10 | Player cleanup'ta streamCandidates ve episodes'in bırakılması | Evet | Sıra doğru: `finally` içinde, `PlayerController.stop()` ve EngineFS release'den sonra. Diziler `null` yerine `[]` atanıyor, bu güvenli. Native stop sırası korunuyor. | KEEP |
| L11 | Stream chip duplicate düzeltmesi (SRC-01) | Evet. `known` döngü içinde güncellenmiyordu. | Tek satırlık doğru düzeltme; test var. | KEEP |

## Root notları

- Sağ üstteki `birkan` etiketi kaynakta sabit metin olarak bulunmadı. Muhtemelen aktif profil adından geliyor. Kontrol noktası 31'e göre TV'de mevcut, ama bu incelemede yeniden doğrulanmadı.
- Badge warmup kaldırma iddiası app.js'de (N4) doğrulandı.
- Auth, profil, addon ve native player kodunda bu diff kapsamında davranış değişikliği bulunmadı.

## Önerilen düzeltme sırası (küçükten büyüğe)

1. **N2:** Back ve popstate yollarında `navigationRequestId` artır. Tek satır; yarış durumunu kapatır.
2. **N1a:** load-app.js'te `onerror` olunca `app.bundle.js` fallback'i ekle. Uygulamanın hiç açılmama riskini kapatır.
3. **L8:** Erken return'den önce rAF alanını sıfırla. **L4:** flush'a try/catch ekle.
4. **H1a:** İlk sync'teki çift tam yazmayı kaldır. **H1b:** See All map'ini bölgesel güncellemede yenile.
5. **H8:** Gerekçeyi yaz ve TV'de ölç, ya da HEAD koşulunu geri getir.
6. **N2a:** Chunk hatasını kullanıcıya göster.
7. TV kabulü:
   - `file://` modül yükleme
   - Geç chunk sonrası stream odağı
   - Eşik 24 ile pencere yolu
   - Tuş tekrar hissi
   - Cold, warm ve gerçek kumanda ölçümleri
