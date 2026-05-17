# 헬프버튼 (HelpButton)

Senior-friendly Korean voice assistant. Speak into one big microphone button → Claude classifies intent (scam check, family call, help message, phone-usage guide) → app suggests **confirmation-gated** safe actions.

- **No login.** State is on-device (localStorage).
- **Korean-first** UI, large text, calm teal palette, voice replies via Web Speech API.
- **Vercel** hosts the web app + serverless `/api/classify` (Claude Opus 4.7).
- **Google Play** distribution via Trusted Web Activity (TWA) wrapping this PWA.

---

## Local development

```bash
npm install
cp .env.example .env.local   # then fill in ANTHROPIC_API_KEY
npm run dev                  # http://localhost:5173 — UI works (falls back to mock classifier)
npm run build                # type-check + production build into dist/
```

For full-stack local dev (real `/api/classify` calls):

```bash
npm i -g vercel
vercel link                  # connect this folder to a Vercel project
vercel dev                   # runs UI + serverless functions together
```

---

## Deploy to Vercel

1. Push this folder to GitHub.
2. In Vercel: **Add New → Project** → import the repo. Vercel auto-detects Vite.
3. Project Settings → **Environment Variables**:

   | Name                | Value                          | Required |
   |---------------------|--------------------------------|----------|
   | `ANTHROPIC_API_KEY` | Your Anthropic API key         | ✅       |
   | `ANTHROPIC_MODEL`   | `claude-opus-4-7` (default)    | optional |

4. Deploy. Note your production URL (e.g. `helpbutton-app.vercel.app`). This is the URL the Android app will point at.

**Optional: custom domain.** Vercel → Project → Domains → add your domain. Recommended before generating the Android package, because the package is locked to one origin.

After deploying, verify:

- `https://your-domain.com/` loads the app
- `https://your-domain.com/privacy` opens the privacy policy
- `https://your-domain.com/manifest.webmanifest` returns JSON
- `https://your-domain.com/.well-known/assetlinks.json` returns the placeholder JSON (you'll fill in the fingerprint below)

---

## Build the Android App Bundle (AAB)

Use **PWABuilder.com** — free, web-based, no Android SDK install needed.

1. Go to **<https://www.pwabuilder.com>**.
2. Enter your deployed URL → **Start**.
3. PWABuilder lints the manifest, icons, and service worker. Fix any warnings it surfaces (most should already be clean).
4. Click **Package For Stores → Android**.
5. **Package options** that matter for Play Store:
   - **Package ID** — pick a reverse-DNS identifier, e.g. `kr.helpbutton.app` or `com.yourbrand.helpbutton`. Once you publish to Play, this is permanent — choose carefully.
   - **App version** — start at `1.0.0` (version code `1`).
   - **Display mode** — `Standalone`.
   - **Notification delegation** — leave on (lets the TWA show web push notifications).
   - **Signing key** — choose **"PWABuilder generates one for me"** on the first build. Save the `.keystore` file and the password to a password manager — **you cannot republish updates with a different key**. Lose the key and you must publish a brand-new app under a new package ID.
6. Click **Generate**. You'll get a ZIP containing:
   - `app-release-bundle.aab` ← upload to Play Console
   - `app-release-signed.apk` ← for sideload testing
   - `signing.keystore` + password file
   - `assetlinks.json` ← the **filled-in** version

### Wire up the asset link

Open the `assetlinks.json` PWABuilder generated. It contains your real package name and SHA-256 fingerprint. Copy that into `public/.well-known/assetlinks.json` in this repo, replacing the placeholder values, and redeploy to Vercel.

After redeploy, verify on the live site:

```bash
curl https://your-domain.com/.well-known/assetlinks.json
```

Should return the JSON with your real fingerprint. **The TWA will refuse to enter fullscreen mode without this** — the user would see a Chrome URL bar at the top of the app.

---

## Submit to Google Play

1. Create a Play Console account ($25 one-time): <https://play.google.com/console>
2. **Create app** → name "헬프버튼", default language Korean, app type **App**, free or paid.
3. **App content** — fill out every section. The required ones:
   - **Privacy policy URL** → `https://your-domain.com/privacy`
   - **App access** — no login required (note this).
   - **Ads** — likely "no ads."
   - **Content rating** — answer the questionnaire honestly. Should rate as ages 3+.
   - **Target audience** — adults (avoid the "Designed for Families" track unless you explicitly want it).
   - **Data safety** — declare what you collect:
     - Voice/audio: **collected, not shared**, processed in real time, for app functionality.
     - Contacts (보호자 phone): **collected**, stored **on device only**, for app functionality.
     - Diagnostics: none (unless you add analytics later).
4. **Main store listing** — Korean (primary):
   - App icon: PWABuilder generated a 512×512 in the ZIP. Use that.
   - Feature graphic (1024×500): create separately.
   - Phone screenshots: at least 2.
5. **Production → Create new release** → upload the `.aab` from PWABuilder.
6. First submission goes through review (1–7 days typically).

> ⚠️ For first submission, Google now requires you do a **closed test with at least 12 testers for 14 days** before being eligible for production. Run it as closed testing first, gather opt-ins via email, then promote to production after the 14-day window.

---

## Updating the app

Two types of update — they're very different:

### A. UI / API logic change
Just `git push` → Vercel auto-deploys → **users get the update the next time they open the app**. No Play Store review. This is most of the value of TWA.

### B. Manifest / package ID / permissions change
You need to rebuild the AAB in PWABuilder (use the **same** keystore from the first build) and upload a new version to Play Console. Bump `versionCode` by 1 in PWABuilder before generating.

---

## Files of interest

| File | Purpose |
|---|---|
| `api/classify.ts` | Vercel serverless function. Calls Claude Opus 4.7 with prompt caching + structured-JSON output. **Holds the API key** (in env var). |
| `src/lib/api.ts` | Client wrapper — calls `/api/classify`, falls back to mock when offline. |
| `src/lib/speech.ts` | Web Speech API (ko-KR) STT + TTS. |
| `src/lib/storage.ts` | All on-device persistence (no server-side user data). |
| `src/screens/*` | The 8 senior screens. |
| `public/icon.svg` | Source of truth for icons. Edit, then `npm run generate-pwa-assets` to regenerate PNGs. |
| `public/privacy.html` | Privacy policy — Play Store requires a URL pointing here. |
| `public/.well-known/assetlinks.json` | TWA domain verification. **Must contain your APK signing fingerprint after first build.** |
| `vercel.json` | Routing, function runtime, asset-links Content-Type. |
| `vite.config.ts` | vite-plugin-pwa manifest + service-worker config. |

---

## Safety guarantees baked into the code

The app refuses certain actions by design — not by good intentions:

- **Schema-level whitelisting**: the `output_config.format` JSON schema in `api/classify.ts` lists every allowed action kind. "Send OTP", "transfer money", and similar simply don't exist as schema enum values, so even if Claude hallucinates one, the client has nothing to render.
- **System prompt**: explicitly classifies any banking / OTP / password / personal-info request as `unsafe_request`.
- **Confirmation gate**: every action with a `confirm_prompt` shows a modal before executing.
- **Phone numbers come from user-stored contact, never from Claude**: a scam variant of Claude couldn't direct a senior to call a scammer's phone number.
- **`delete_message` is advisory only**: the app never deletes anything on behalf of the user; it just tells them to open Messages and delete it themselves.

---

## License

Private. Add a license file if open-sourcing.
