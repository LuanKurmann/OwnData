# OwnData

**Selbst gehostete Alternative zu Incogni Unlimited.** OwnData verschickt Lösch-, Auskunfts- und Widerspruchsanfragen an Datenbroker über dein eigenes E-Mail-Postfach, liest die Antworten per IMAP ein, überwacht Fristen, mahnt automatisch und bereitet Beschwerden an die Aufsichtsbehörde vor.

Rechtsgrundlagen: **Schweizer DSG** (Art. 25, 30, 32), **EU-DSGVO** (Art. 15, 17, 21) und **US CCPA/CPRA** (§ 1798.105, .110, .120). Oberfläche auf Deutsch und Englisch.

> English summary at the bottom.

## Funktionen

- **Kuratierte Broker-Liste** (CH, DE/AT, EU, US: Personensuche, Adresshandel, Bonität, B2B-Daten, Adtech) plus **eigene Einträge** für jede Website, die deine Daten zeigt. Die App sucht auf der Website automatisch nach einer Datenschutz-Kontaktadresse.
- **Rechtssichere Vorlagen** in DE/EN pro Rechtsordnung und Anfrageart, mit Platzhaltern für deine Profildaten. Jede Vorlage ist pro Nutzer überschreibbar.
- **Versand über dein Postfach** (SMTP). Jede Anfrage trägt eine Referenz `[OD-XXXXXX]` im Betreff.
- **Antworten automatisch zuordnen** (IMAP): per Threading-Header, Referenz oder Absenderdomain. Antworten werden heuristisch eingestuft (bestätigt, erledigt, abgelehnt, Rückfrage).
- **Fristen und Eskalation**: 30 Tage (DSG/DSGVO) bzw. 45/15 Tage (CCPA). Nach Ablauf automatische Erinnerung, 14 Tage später Status „Eskalation möglich“ mit fertigem Beschwerdetext (EDÖB, EU-Aufsichtsbehörde, CPPA).
- **Mehrnutzerfähig**: Login mit E-Mail und Passwort, erster Nutzer ist Admin, Registrierung per `ALLOW_REGISTRATION` steuerbar. Jeder Nutzer hat eigenes Profil, Mailkonto, eigene Broker und Vorlagen.
- **Zwei Betriebsarten**: Docker-Container mit lokaler SQLite-Datei, oder Vercel (Hobby, gratis) mit Turso als gehosteter libSQL-Datenbank.

## Schnellstart mit Docker

```bash
git clone https://github.com/LuanKurmann/OwnData.git
cd OwnData
cp .env.example .env
# APP_SECRET setzen:
sed -i "s/^APP_SECRET=.*/APP_SECRET=$(openssl rand -hex 32)/" .env
docker compose up -d --build
```

Dann `http://localhost:3000` öffnen, den ersten Benutzer registrieren und die Einrichtung in der Übersicht abarbeiten:

1. **Profil** ausfüllen (Name, Adressen, E-Mails, Telefon, Geburtsdatum nach Bedarf).
2. **E-Mail-Konto** hinterlegen. Empfehlung: eigene Adresse wie `datenschutz@deinedomain.ch`. Gmail braucht ein App-Passwort, Proton die Proton Bridge. SMTP und IMAP testen.
3. Unter **Datenbroker** Einträge auswählen, Anfrageart wählen und „Anfragen erstellen und senden“.

Die Datenbank liegt im Volume `owndata-data` unter `/data/owndata.db`.

## Gratis auf Vercel deployen

Vercel hat kein persistentes Dateisystem und keinen Dauerprozess. Deshalb liegt die Datenbank bei [Turso](https://turso.tech) (libSQL, gleicher SQL-Dialekt wie SQLite, Gratis-Plan reicht) und der Worker wird per Cron über `/api/worker/run` angestossen.

**1. Turso-Datenbank anlegen** (Turso CLI oder Web-Dashboard):

```bash
turso db create owndata
turso db show owndata --url          # → libsql://owndata-<name>.turso.io
turso db tokens create owndata       # → Auth-Token
```

**2. Vercel-Projekt anlegen**: Repository importieren (Framework: Next.js, keine Build-Anpassung nötig; das Skript `vercel-build` führt vor dem Build die Migrationen aus).

**3. Environment Variables setzen** (Settings → Environment Variables):

| Variable | Wert |
| --- | --- |
| `APP_SECRET` | `openssl rand -hex 32` |
| `APP_URL` | `https://<projekt>.vercel.app` |
| `DATABASE_URL` | `libsql://owndata-<name>.turso.io` |
| `DATABASE_AUTH_TOKEN` | Token aus Schritt 1 |
| `CRON_SECRET` | `openssl rand -hex 32` (Vercel Cron authentifiziert sich damit) |
| `WORKER_TOKEN` | optional, für externe Cron-Dienste |
| `ALLOW_REGISTRATION` | `false` |

**4. Deploy** auslösen, URL öffnen, ersten Benutzer registrieren.

**Worker-Takt**: `vercel.json` definiert einen täglichen Cron (06:00 UTC), mehr erlaubt der Hobby-Plan nicht. Für den normalen Betrieb reicht das: Versand passiert zusätzlich sofort beim Klick auf „Anfragen erstellen und senden“, und in jeder Ansicht gibt es „Jetzt verarbeiten“. Willst du Antworten öfter abholen, trägst du bei einem Gratis-Dienst wie [cron-job.org](https://cron-job.org) alle 10 bis 15 Minuten diesen Aufruf ein:

```
GET https://<projekt>.vercel.app/api/worker/run
Header: x-worker-token: <WORKER_TOKEN>
```

Serverless-Funktionen laufen auf dem Hobby-Plan maximal 60 Sekunden. Ein Lauf verschickt daher pro Aufruf nur so viele Mails, wie in die Zeit passen; der Rest bleibt in der Warteschlange und geht beim nächsten Lauf raus.

## Lokale Entwicklung

```bash
npm install
cp .env.example .env   # APP_SECRET setzen
npm run dev            # http://localhost:3000
```

Nützliche Befehle: `npm run typecheck`, `npm run lint`, `npm run build`, `npm run db:generate` (neue Migration nach Schemaänderung).

## Konfiguration

| Variable | Bedeutung | Standard |
| --- | --- | --- |
| `APP_SECRET` | Signiert Sessions und verschlüsselt Mail-Passwörter (AES-256-GCM). Pflicht. | – |
| `APP_URL` | Öffentliche URL, steuert u.a. `Secure`-Cookies. | `http://localhost:3000` |
| `DATABASE_URL` | libSQL-URL: `file:./data/owndata.db` lokal, `libsql://…turso.io` auf Vercel. | `file:./data/owndata.db` |
| `DATABASE_AUTH_TOKEN` | Turso-Token, nur bei Remote-Datenbank. | leer |
| `CRON_SECRET` | Bearer-Token, mit dem Vercel Cron `/api/worker/run` aufruft. | leer |
| `ALLOW_REGISTRATION` | Weitere Nutzer dürfen sich registrieren. Der erste Nutzer kann immer registrieren. | `false` |
| `WORKER_INTERVAL_MINUTES` | Intervall des Hintergrund-Workers (Docker/VPS). `0` deaktiviert. Auf Vercel ohne Wirkung. | `10` |
| `WORKER_TOKEN` | Optional. Erlaubt `GET/POST /api/worker/run` mit Header `x-worker-token` von aussen (z.B. cron-job.org). | leer |
| `DEFAULT_LOCALE` | Standardsprache `de` oder `en`. | `de` |

## Ablauf einer Anfrage

```
Entwurf → Wartet auf Versand → Gesendet → Bestätigt / Rückfrage
                                  │
                        Frist abgelaufen → Überfällig → Erinnerung → Erinnert
                                                                      │
                                                   14 Tage ohne Erfolg → Eskalation möglich → Eskaliert
Antwort erkannt: Erledigt / Abgelehnt
```

Status lassen sich jederzeit manuell setzen. Antworten, die nicht eingestuft werden konnten, erscheinen in der Übersicht unter „Braucht Aufmerksamkeit“.

## Hinweise

- Die Kontaktdaten der kuratierten Broker stammen aus öffentlichen Datenschutzerklärungen (Stand Oktober 2026) und können sich ändern. Prüfe sie vor dem ersten Versand und erstelle bei Bedarf eine eigene Kopie des Eintrags. Ergänzungen sind in `src/data/brokers.json` willkommen.
- Die Vorlagen verzichten bewusst auf Ausweiskopien. Verlangt ein Empfänger einen Identitätsnachweis, erkennt die App das meist als „Rückfrage“; entscheide dann selbst, was du nachreichst.
- CCPA-Rechte gelten formal für Einwohner Kaliforniens. Viele US-Broker löschen trotzdem weltweit; die Vorlagen sind entsprechend formuliert.
- OwnData ist keine Rechtsberatung.

## Technik

Next.js 15 (App Router, Server Actions), TypeScript, Drizzle ORM mit libSQL (`@libsql/client`: lokale Datei oder Turso), Tailwind CSS 4, next-intl, Nodemailer, ImapFlow, Zod. Migrationen laufen beim Start (Docker) bzw. im Build (Vercel), Seed-Daten (Broker, Vorlagen) werden ergänzt, bestehende Nutzerdaten nie überschrieben.

---

## English summary

OwnData is a self-hosted alternative to Incogni Unlimited. It sends erasure, access and opt-out requests to data brokers through your own mailbox (SMTP), matches replies via IMAP, tracks statutory deadlines (Swiss FADP, EU GDPR, US CCPA), sends reminders automatically and prepares complaints to the supervisory authority. It ships with a curated broker list, supports custom removals with automatic privacy-contact discovery, is multi-user with e-mail/password login, and has a German/English UI. Run it with `docker compose up -d --build` after setting `APP_SECRET` in `.env`, or deploy to Vercel's free Hobby plan with a Turso database (`DATABASE_URL` + `DATABASE_AUTH_TOKEN`) and the included daily cron.
