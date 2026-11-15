# LinguaLens

**A bilingual lens for the web.** A Chrome extension + self-hosted translation backend that turns any YouTube video into bilingual subtitles and exports bilingual SRT/VTT.

[中文说明](README.zh-CN.md)

![YouTube bilingual subtitles](docs/screenshot-subtitles.png)

## What it does

- **Bilingual subtitles on YouTube** — detects the video's caption track, translates it sentence by sentence, and renders the translation right under the original line, following playback.
- **Download bilingual subtitles** — one click exports bilingual / translation-only / original-only subtitles as SRT or VTT, with correct timelines.
- **Works when YouTube blocks captions** — four fallback strategies for caption retrieval, plus a manual import path: drop in any SRT/VTT and LinguaLens still translates and exports it.
- **No API key in the client** — translation goes through your own backend; the model token stays server-side.

## Roadmap

- [ ] Draggable subtitle overlay — move the subtitle box anywhere on the video.
- [ ] Whole-page translation — translate any web page paragraph by paragraph, original and translation side by side.
- [ ] Per-site rules and language auto-detection.

## Architecture

```
Chrome MV3 extension  ──HTTP──▶  Next.js backend  ──▶  LLM (built-in token)
 content / background / popup     /api/translate
 options / injected (page world)  /api/youtube/timedtext
                                  /api/health
```

| Path | Role |
| --- | --- |
| `src/app/api/translate/route.ts` | Batch translation endpoint (JSON array in, array out) |
| `src/app/api/youtube/timedtext/route.ts` | Server-side caption proxy fallback |
| `src/app/api/health/route.ts` | Health, model name, supported languages |
| `src/lib/translate.ts` | Batching (24 cues), concurrency (4), in-process cache, per-line fallback |
| `public/extension/` | The Chrome extension source |
| `scripts/build-extension.cjs` | Packages the extension into a zip |
| `tests/e2e-*.js` | Playwright end-to-end tests with a real Chromium + the loaded extension |

### Caption retrieval strategy

YouTube has tightened `timedtext` validation (PoToken + origin checks) since 2025, so the extension tries four routes in order and uses the first one that returns content:

1. `youtube.com/api/timedtext` from the background service worker (extension host permissions).
2. `fetch` from the page world (same-origin, carries page cookies).
3. Reuse a `pot=`-signed timedtext URL captured from the player's own network requests.
4. The official transcript panel endpoint (`youtubei/v1/get_transcript`).

If all four fail, the overlay says so and you can import a local subtitle file instead.

## Quick start

### 1. Run the backend

```bash
bash ./scripts/prepare.sh   # install dependencies (first run only)
bash ./scripts/dev.sh       # dev server on http://localhost:5050
```

> Port 5050 by default, because macOS AirPlay Receiver occupies 5000. Override with `PORT=6000 bash ./scripts/dev.sh` and update the extension's backend URL accordingly.

Verify:

```bash
curl -s http://localhost:5050/api/health
curl -s -X POST http://localhost:5050/api/translate \
  -H 'Content-Type: application/json' \
  -d '{"texts":["Attention is all you need."],"targetLang":"zh-CN"}'
```

### 2. Install the extension

1. Unzip `public/tobytranslate-youtube-bilingual-v1.0.0.zip` into a permanent folder.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and pick the unzipped folder (it must contain `manifest.json`).
4. Open any YouTube video — the subtitle overlay appears in the bottom right of the player.

The extension defaults to `http://localhost:5050`; change it in the popup → 设置 or the options page, then click **测试连接**.

## Usage

| Action | How |
| --- | --- |
| Translate subtitles | Open a YouTube video; translation starts automatically |
| Toggle subtitles | Overlay toggle or `Alt + T` |
| Download subtitles | Overlay button, `Alt + D`, or the popup panel (bilingual / translation / original × SRT / VTT) |
| Change target language | Popup → target language (14 languages) |
| Import local subtitles | Popup → import local subtitle file (SRT / VTT) |
| Tune appearance | Options page: font size, vertical position, hide native captions, show original |

## API

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Status, model, languages, uptime |
| `POST` | `/api/translate` | `{ texts: string[], targetLang?: string }` → `{ translations: string[] }` |
| `GET` | `/api/youtube/timedtext` | Caption proxy: `?url=<timedtext url>` or `?v=<videoId>&lang=<code>` |

## Tests

```bash
pnpm ts-check && pnpm lint:build && pnpm lint:style
node tests/e2e-extension.js   # 12 assertions: rendering, shortcuts, SRT/VTT export
node tests/e2e-import.js      # 8 assertions: manual subtitle import path
```

The E2E scripts drive a real Chromium with the extension loaded and a fake YouTube page (`tests/fixtures/youtube-fixture.html`) so they don't depend on YouTube's anti-bot behaviour.

## Known limitations

- YouTube caption availability depends on your network. From datacenter IPs, YouTube often returns `is_servable: false` and empty caption bodies; use a normal home network, or the manual import path.
- Long videos (500+ cues) take tens of seconds on first translation; cues appear progressively.
- The translation cache is in-process, so it is cleared when the backend restarts.
- Translation quality and speed depend on the configured LLM model.

## License

MIT
