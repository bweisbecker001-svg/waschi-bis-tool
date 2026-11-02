# STRATO-Migration für Waschi.fun

Dieser Ordner bereitet den Umzug der Homepage von Vercel auf STRATO Hosting Starter vor. Er ändert noch keine Live-Domain.

## Zielaufbau
- STRATO: statische Homepage + PHP-API + lokale JSON-Daten
- Altare: Waschi Discord Gateway Bot 24/7
- BiS-App: vorerst separat auf Vercel; unbekannte /api/-Routen werden über STRATO weitergeleitet

## Test-Subdomain
1. In STRATO eine Test-Subdomain anlegen, z. B. test.waschi.fun, mit eigenem Zielordner.
2. Den kompletten Inhalt von homepage-overlay/ in diesen Zielordner kopieren, außer vercel.json.
3. Aus strato-migration zusätzlich .htaccess, api/ und private/ hochladen.
4. Sicherstellen, dass private/data/ für PHP schreibbar ist; die API legt den Ordner bei Bedarf selbst an.

## Konfiguration
In private/config.php Discord Client-ID, Discord Client-Secret, Redirect-URI sowie zwei lange Zufallswerte für voice_push_secret und session_secret setzen.
Für die Testphase als Redirect-URI https://test.waschi.fun/api/site-auth/callback verwenden und diese im Discord Developer Portal ergänzen.

## Altare
worker-strato.py ist die Zielversion. Auf Altare zusätzlich VOICE_PUSH_SECRET und WASCHI_API_BASE=https://test.waschi.fun setzen.
Nach erfolgreicher Umschaltung WASCHI_API_BASE auf https://waschi.fun ändern.
Der BLOB_READ_WRITE_TOKEN wird danach nicht mehr benötigt.

## Tests vor Live-Schaltung
- /api/health
- /api/site-content
- Discord Login/Logout
- Kalender CRUD
- News CRUD
- Voice-Push aus Altare und /api/discord-online
- Startseite, Gilde, M+ Teams, Streams, Download, Impressum
- Charakterseiten über temporären Legacy-API-Proxy
- /bis/ eingebettetes BiS-Tool

## Live-Umschaltung
Erst nach erfolgreichen Tests die Domain-Ziele von waschi.fun und www.waschi.fun auf den neuen STRATO-Webspace setzen.
Vercel zunächst als Rollback-Option behalten.
