# JF Alarmsystem 🚒

Ein leichtgewichtiges Alarm- und Leitstellensystem für die **Jugendfeuerwehr**.  
Es besteht aus drei Teilen:

| Komponente | Beschreibung | Technologie |
|---|---|---|
| **Alarm_Server** | Push-Server, der Expo-Push-Benachrichtigungen an registrierte Geräte sendet | Node.js / Express |
| **Web_Leitstelle** | Browser-Dashboard für Einsatzverwaltung, Fahrzeugstatus und Alarmierung | React / Vite |
| **Mobile_App** | Native App für Feuerwehrmitglieder – empfängt Alarme als Push-Benachrichtigung | React Native / Expo |

---

## Voraussetzungen

- **Node.js** ≥ 18  ([nodejs.org](https://nodejs.org))
- **npm** ≥ 9 (wird mit Node.js mitgeliefert)
- **Expo CLI** (nur für die Mobile App): `npm install -g expo-cli`
- Ein echtes iOS- oder Android-Gerät mit der **Expo Go**-App für Push-Benachrichtigungen

---

## Schnellstart (Alles auf einmal)

```bash
# 1. Repository klonen
git clone https://github.com/Wayveee/JF_Alarmsystem.git
cd JF_Alarmsystem

# 2. Alle Abhängigkeiten installieren
npm run install:all

# 3. Alarm-Server + Web-Leitstelle gleichzeitig starten
npm run dev
```

Die Web-Leitstelle ist dann unter **http://localhost:5173** erreichbar,  
der Alarm-Server unter **http://localhost:3000**.

---

## Einzelne Komponenten starten

```bash
# Nur Alarm-Server
npm run start:server   # http://localhost:3000

# Nur Web-Leitstelle (Entwicklungsmodus)
npm run start:web      # http://localhost:5173

# Web-Leitstelle für Produktion bauen
npm run build:web      # Ausgabe in Web_Leitstelle/dist/

# Mobile App (Expo)
npm run start:mobile   # QR-Code scannen mit Expo Go
```

---

## Konfiguration

### Alarm-Server (`Alarm_Server/.env`)

```bash
cp Alarm_Server/.env.example Alarm_Server/.env
```

| Variable | Standard | Beschreibung |
|---|---|---|
| `PORT` | `3000` | Port des Alarm-Servers |
| `ALLOWED_ORIGINS` | `http://localhost:5173,...` | Erlaubte CORS-Origins, kommagetrennt |

### Web-Leitstelle (`Web_Leitstelle/.env`)

```bash
cp Web_Leitstelle/.env.example Web_Leitstelle/.env
```

| Variable | Standard | Beschreibung |
|---|---|---|
| `VITE_SERVER_URL` | `http://localhost:3000` | URL des Alarm-Servers |

> **Tipp für LAN-Betrieb:** Setze `VITE_SERVER_URL` auf die lokale IP-Adresse deines Servers,  
> z. B. `http://192.168.0.10:3000`, damit die Leitstelle auch vom Handy im gleichen Netzwerk erreichbar ist.

### Mobile App

Die Server-URL wird direkt in der App über ein Eingabefeld konfiguriert.  
Trage dort die **Netzwerk-IP** deines Alarm-Servers ein (z. B. `http://192.168.0.10:3000`).

---

## Architektur

```
┌─────────────────────┐        POST /alarm        ┌──────────────────────┐
│   Web-Leitstelle    │ ────────────────────────► │    Alarm-Server      │
│  (Browser / React)  │                           │  (Node.js / Express) │
└─────────────────────┘                           └──────────┬───────────┘
                                                             │
                                                  Expo Push API (exp.host)
                                                             │
                                                  ┌──────────▼───────────┐
                                                  │     Mobile App       │
                                                  │  (iOS / Android)     │
                                                  └──────────────────────┘
```

1. Die **Web-Leitstelle** legt Einsätze an und alarmiert Fahrzeuge.
2. Bei einer Alarmierung sendet die Leitstelle einen `POST /alarm`-Request an den **Alarm-Server**.
3. Der Alarm-Server leitet die Nachricht als Push-Benachrichtigung über die **Expo-Push-API** an alle registrierten Geräte weiter.
4. Die **Mobile App** empfängt die Benachrichtigung und weckt das Gerät auf.

---

## Mobil-App einrichten

1. Expo Go App auf dem Gerät installieren ([iOS](https://apps.apple.com/app/expo-go/id982107779) / [Android](https://play.google.com/store/apps/details?id=host.exp.exponent))
2. `npm run start:mobile` ausführen
3. QR-Code in der Expo Go App scannen
4. Im App-Eingabefeld die IP-Adresse des Alarm-Servers eintragen
5. **„Bei Server registrieren"** tippen – das Gerät empfängt ab jetzt Alarme

---

## API-Referenz (Alarm-Server)

| Methode | Pfad | Beschreibung |
|---|---|---|
| `GET` | `/` | Healthcheck |
| `GET` | `/stats` | Anzahl registrierter Tokens |
| `POST` | `/register` | Gerät registrieren `{ token: "ExponentPushToken[…]" }` |
| `POST` | `/alarm` | Alarm auslösen `{ title, body, data }` |

---

## Lizenz

Siehe [LICENSE.md](LICENSE.md)
