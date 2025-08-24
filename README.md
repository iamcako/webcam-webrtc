# Basit WebRTC Webcam (iPhone → İnternet → İzleyici)

Bu proje; bir iPhone'un kamerasını **WebRTC** ile canlı yayınlaması, diğer cihazların (telefon, tablet, PC) ise **sadece izlemesi** için en basit örneği sağlar. **Kayıt yoktur.**

> **ÖNEMLİ (iOS/Safari):** iPhone kameraya erişmek için sayfayı **HTTPS** ile açmanız gerekir (localhost hariç). Bu yüzden projeyi bir ücretsiz host'a deploy etmeniz tavsiye edilir (Render, Railway, Fly.io, Glitch vs.). Yerelde testte iPhone ile `http://192.168.x.x` üzerinden kamera vermez.

## Hızlı Kurulum (Yerel)
1. Node 18+ kurulu olmalı.
2. Projeyi indirin ve çıkarın:
   ```bash
   npm install
   npm start
   ```
3. Masaüstünde test: Tarayıcıdan `http://localhost:3000` → **Yayıncı** ve **İzleyici** sekmelerini ayrı pencerelerde açıp deneyebilirsiniz.

> iPhone ile yerelde test için HTTPS gerekecektir. Lokal HTTPS kurmak isterseniz `mkcert` ile self-signed sertifika oluşturup sunucuyu HTTPS'e çevirebilirsiniz (README'nin sonunda ipucu var).

## Canlıya Alma (Önerilen)
1. **Render.com** (veya benzeri) üzerinde yeni bir Web Service oluşturun.
2. Kaynak kodu zip olarak yükleyin.
3. Build komutu: *(boş bırakın)*, Start komutu: `node server.js`.
4. Yayına çıktıktan sonra uygulama size **HTTPS URL** verir: `https://<proje-adınız>.onrender.com`
5. iPhone'da **/broadcast.html** sayfasını açın. İzleyiciler **/viewer.html** sayfasını açar.

## Kullanım
1. **Yayıncı (iPhone)**: `/broadcast.html` → Oda kodu (ör. `sabah-spor`) → **Yayını Başlat**
2. **İzleyici**: `/viewer.html` → Aynı oda kodu → **İzlemeye Başla**

Bu örnek **çok basit** bir sinyalleşme uygular:
- Birden çok izleyici mümkün; yayıncı tarafında her izleyici için ayrı WebRTC bağlantısı kurulur.
- NAT/Firewall koşullarında çoğu durumda **STUN** yeterli olacaktır, ancak bazı ağlarda **TURN** sunucusu gerekebilir (ör. Twilio/Nginx TURN). Bu örnekte TURN yoktur.

## Sık Sorular
- **Ses yok mu?** Varsayılan olarak kapalıdır (çocukları izlemek için genelde gerekmiyor). İsterseniz `broadcast.html` içinde `audio: false` → `true` yapabilirsiniz. iOS'ta otomatik oynatma için izleyicide video başlangıçta `muted` ayarlı; kullanıcı dokununca sesi açabilir.
- **Aynı anda çok izleyici?** Basit örnek birden çok izleyiciyi destekler ama yayıncı cihazın CPU/Bandwidth kısıtı vardır. Fazla izleyici için SFU (Janus/mediasoup) gerekir.
- **HTTPS zorunlu mu?** Evet, iPhone kamerası için şart (localhost hariç).

## Güvenlik
- Herkes oda kodunu bilirse bağlanabilir. Oda adını tahmin edilmesi zor yapın (ör. `sabah-spor-2025-08-24-CK9m`).
- Kamuya açık deploylarda temel erişim koruması eklemek isteyebilirsiniz (ör. basit bir şifre).

## İleri (Opsiyonel) – Lokal HTTPS
- `mkcert` ile sertifika üretip `server.js` dosyasını HTTPS sunacak şekilde güncelleyebilirsiniz.
- Veya Caddy/NGINX reverse proxy ile HTTPS terminasyonu yapabilirsiniz.

İyi yayınlar!
