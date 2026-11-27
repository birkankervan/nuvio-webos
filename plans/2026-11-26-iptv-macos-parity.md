# IPTV-PARITY: TV IPTV ekranı = macOS IPTV (aktif plan)

Oluşturma: 2026-11-26. Sahip: root (Opus, review + entegrasyon). Araştırma: Haiku
(macOS spec + TV spec, bu konuşmada). Kod: Sonnet subagent. Kaynak: NuvioDesktop
`composeApp/src/commonMain/kotlin/com/nuvio/app/features/iptv/`.

## Fark (özet)

macOS: üstte sekme chip'leri + arama + hesap butonları; gövde 3 kolon:
kategori listesi (260dp) | öğe satır listesi (400dp; numara, 48dp logo, ad,
ilerleme, ✓) | sağ panel (canlı: 16:9 önizleme video + bilgi + Tam ekran + EPG
Şimdi/Sonra; film: poster + başlık + Oynat + ★ + özet; dizi: kapak + özet +
sezon chip'leri + bölüm listesi). Seçim = odak, canlıda önizleme otomatik oynar.

TV (şimdi): büyük başlık bloğu, 3 sütun kanal kartı / 5 sütun poster ızgarası,
film/dizi tam ekran detay overlay'i, ekranda video yok, EPG yok, izlendi tiki yok.

## Kararlar

1. Tek layout, 3 kolon. TV ölçeği macOS dp × ~1.5: kategori 390px, öğe listesi
   600px, gap 18px, panel flex 1. Renkler TV tokenlarıyla: seçili = `--card-bg`
   - metin `--secondary-color`; odak = `--focus-color` kenar + `--focus-bg`.
2. Detay overlay'i kalkar; film/dizi detayı sağ panelde. Poster ızgarası kalkar,
   öğeler tek kolon sanal liste (mevcut `iptvVirtualList`, columns 1).
3. Canlı önizleme: yeni `iptvPreview.js`, `<video>` + hls.js (`globalThis.Hls`),
   yoksa native src. Odak değişiminde debounce (`PREVIEW_DEBOUNCE_MS = 500`,
   macOS 200; TV'de ayar düğmesi). Player'a gitmeden ÖNCE önizleme tamamen
   kapatılır (tek bağlantı sağlayıcı). Kesintisiz devir (macOS Adım 5) yok:
   tam ekran yeniden bağlanır. cleanup'ta da kapanır.
4. EPG: `IptvRepository.getShortEpg(sourceId, channelId, {signal})` →
   `[{title, description, startMs, endMs}]` (get_short_epg, limit 2, base64
   decode). Hata sessiz.
5. İzlendi: `iptvProgressStore` ≥%90'da silmek yerine `{watched:true}` tutar;
   resume watched'ı yok sayar. Satırda ✓, kısmi ilerleme 3px çubuk.
6. Korunan TV özellikleri: çoklu kaynak (Kaynak/Yenile/Düzenle/Ekle/Sil header'da
   metin buton), favoriler (OK basılı tut), kanal numarası, ayraç satırları,
   arama, hesap formu, preset, player zap, route state, Magic Remote pointer.
7. Film: tek buton; konum varsa "Devam et (mm:ss)" yoksa "Oynat" (macOS gibi
   otomatik resume). Baştan oynat kalkar.
8. Kapsam dışı (sonraki adım, kullanıcıya sorulacak): tam ekran player içinde
   kanal listesi paneli (macOS Adım 6), kesintisiz devir.

## Klavye (kumanda)

- Header ↔ kategoriler ↔ öğeler ↔ panel. ←/→ kolonlar arası, ↑/↓ kolon içi.
- Kategori: ↑/↓ odak, OK veya → seçer ve öğelere geçer (mevcut davranış).
- Öğe: ↑/↓ odak = seçim (ayraçlar atlanır). OK: canlı → tam ekran (basılı
  tutma favori), film → oynat, dizi → bölüm paneline geç. → panele, ← kategoriye.
- Panel canlı/film: buton odakta, OK oynatır. ← öğelere.
- Panel dizi: bölümler ↑/↓; en üstte ↑ sezon chip'lerine; chip'te ←/→ sezon,
  ↓ bölümlere; CH+/CH- (33/34) sezon değiştirir; OK bölüm oynatır; ← öğelere.
- Back: panel → öğeler → kategoriler → sidebar.
- Bitmiş bölümden dönünce seçim sonraki bölüme kayar (otomatik oynamaz).

## İşler ve dosya sahipliği

| İş                    | Sahip    | Dosyalar                                                                                                                   | Durum                                 |
| --------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| T1 EPG + watched      | Sonnet-A | `js/data/remote/api/xtreamApi.js`, `js/data/repository/iptvRepository.js`, `js/data/local/iptvProgressStore.js` + testleri | TAMAM, root review OK (39 test geçti) |
| T2 UI                 | Sonnet-B | `js/ui/screens/iptv/*`, `css/iptv.css`                                                                                     | TAMAM, root review + TV doğrulandı    |
| Review/entegrasyon/TV | root     | —                                                                                                                          | bekliyor                              |

## Kabul

- `node --test` IPTV testleri + lint + `npm run package:webos` geçer.
- TV: 3 kolon görünür; canlı kanalda önizleme oynar, OK ile tam ekran, Back ile
  aynı kanala dönülür ve önizleme geri gelir; film paneli Oynat; dizi sezon/bölüm
  gezinme ve oynatma; `birkan` etiketi yok.

## Günlük

- 2026-11-26: plan yazıldı.
- 2026-11-26: T1 (Sonnet-A) ve T2 (Sonnet-B) arka planda başlatıldı; dosya sınırları ayrık. macOS spec özeti scratchpad'de (geçici).
- 2026-11-26: T1 tamam: getShortEpg (60s cache), progress watched:true (silinmiyor), iptvResumePositionMs. 39 test geçti, root review OK. iptvVodBarrier.test.mjs 1 satır güncellendi.
- 2026-11-26: T2 tamam (Sonnet-B): 3 kolon layout, tek kolon sanal liste, sağ panel (canlı önizleme+EPG / film / dizi sezon+bölüm), iptvPreview.js, ZONE.PANEL, iptvPosterCards.js silindi, iptvPanel.test.mjs eklendi. Root düzeltmesi: önizleme öncesi `loadStreamingLibs({hls})` (hls.js lazy yükleniyordu, native src'ye düşüyordu).
- 2026-11-26: Kontroller: 81/81 IPTV+data test, eslint, legacy css, prettier, package:webos OK. LG'ye 1.4.4 kuruldu, CDP ile: canlı önizleme hls.js ile oynuyor (CDP ekran görüntüsü video düzlemini beyaz gösterir, normal), EPG Şimdi/Sonra geliyor, OK → önizleme kapanıp player açılıyor, Back → aynı kanal + önizleme geri; dizi paneli →/↓/CH+/↑/← akışı ve Back sırası planla aynı; film paneli OK. Fiziksel kumanda testi yapılmadı. Commit yok.
- Açık: player içi kanal listesi paneli (macOS Adım 6) ve kesintisiz tam ekran devri yapılmadı; EPG "Now/Next" ve bazı yeni metinler i18n anahtarsız (fallback); header'da "Yetişkin göster" chip'i yok (formda var); film paneli poster solda/bilgi sağda (macOS dikey).
- 2026-11-26: Kullanıcı geri bildirimi: canlıda gezinirken önizleme açılmasın, OK ile açılsın (1. OK önizleme, aynı kanalda 2. OK tam ekran); VOD/dizi panelinde puan/tür/yıl/süre/yönetmen/oyuncular/ülke/yaş sınırı görünsün. Sonnet ajanı kodluyor (iptvDetailView/Focus/Data, iptv.css, xtreamApi normalizer).
- 2026-11-26: Geri bildirim turu tamam: canlı önizleme yalnız OK ile (1. OK önizleme, aynı kanalda 2. OK tam ekran; gezinirken/girişte/player dönüşünde otomatik başlamaz — root, resumePreview yolunu sildi). Film/dizi paneli: yıl · ★ · süre · tür satırı + tam genişlik bilgi listesi (Yönetmen, Oyuncular, Ülke, Yaş sınırı, Çıkış tarihi; 22px). xtreamApi country/age/runTime. Hint metni strings.xml (tr/en). 79 test, lint, prettier OK; LG'ye kuruldu, CDP ile akış ve ekran görüntüleri doğrulandı. Commit yok.
- 2026-11-26: Gerçek kumanda olay kaydı (CDP probe): önizleme yalnız OK'de başlıyor, ama ok tuşunda panel odaktaki kanala geçip önizlemeyi kapatıyordu. Kullanıcı isteği: canlıda panel+önizleme yalnız OK ile değişsin, gezinme dokunmasın; aynı kanalda OK tam ekran; Back'te aktif kanal panelde devam etsin. Sonnet düzeltiyor.
- 2026-11-26: Düzeltildi (Sonnet, root review): canlıda panel+önizleme yalnız OK ile değişir (activeLive), gezinme/kategori/arama dokunmaz; aynı kanalda OK ve Tam ekran = aktif kanalı tam ekran; Back'te route state activeChannelId (zap'lı channelId öncelikli) ile panel+önizleme devam; sidebar'dan girişte otomatik oynatma yok. 79 test, lint, prettier OK; LG'de CDP ile doğrulandı. Commit yok.
- 2026-11-26: Player içi kanal listesi başladı (macOS Adım 6 karşılığı). Haiku araştırması: kaynaklar paneli sanal değil ve addon-stream odaklı, canlı IPTV'de Kaynaklar addon araması tetikliyor olabilir; zap All görünümünde categoryId=null yüzünden per-category sağlayıcıda çalışmıyor. Karar: playIptv canlıda "source" aksiyonu (test için ad korunur) "Kanallar" paneli açar (yeni P/playerScreenMethods-77-iptv-channels-panel.js, createVirtualList ile sanal liste), seçim zap'tan çıkarılan switchIptvChannel ile; playChannel her zaman channel.categoryId gönderir. Sonnet kodluyor; dosyalar: player 28/68/70/71 + yeni 77, iptvScreenData.js, player css, strings.xml.
- 2026-11-26: Player kanal listesi kodlandi (Sonnet, root review): playIptv canlida "source" butonu "Kanallar" basligiyla playerScreenMethods-78-iptv-channels-panel.js panelini acar (createVirtualList, ayraclar filtreli, calan kanal odakta). Secim switchIptvChannel ile; calan kanala OK yalniz paneli kapatir. playChannel her zaman channel.categoryId gonderir. Testler: live-player-controls 16/16, iptv 61/61, lint, prettier OK. LG CDP: panel acildi, TRT 1 Vip -> TRT 1 FHD gecisi oldu, Back -> IPTV panelinde yeni kanal oynuyor. Gecis sonrasi paneli yeniden acma CDP koptugu icin dogrulanamadi. Fiziksel kumanda testi bekliyor. Commit yok.
- 2026-11-27: Kanal paneli LG'de tam doğrulandı (CDP): panel açma, TRT 1 FHD -> TRT 4K geçişi, geçiş sonrası paneli yeniden açma (odak yeni kanalda), çalan kanalda OK yalnız kapatır (yayın kesilmedi), Back -> IPTV panelinde yeni kanal + önizleme. Not: TV IP'si 192.168.1.146 oldu (ares cihazı nuvio-lg-145 güncellendi); tam ekran yayın sırasında TV ağı aralıklı kopuyor (Wi-Fi), CDP asılmaları bundan. Kontroller gizliyken Sağ ok tepki vermez, Yukarı ok gösterir (mevcut player davranışı). Commit yok.
