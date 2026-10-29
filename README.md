<p align="left">
  <img src="Images/logo.png" alt="SpotDeck Logo" width="290"/>
</p>

# 🎵 SpotDeck: Spotify Now Playing Dashboard

**SpotDeck** is a sleek, animated "Now Playing" dashboard inspired by the concept of a dedicated media display (like the discontinued Spotify Car Thing). It transforms any spare device—a tablet, a secondary monitor, or a spare phone—into a beautiful, interactive music display with real-time album art ambience and playback controls.

## ✨ Features

  * **Real-Time Playback Info:** Displays the current track's title, artist, album, and progress.
  * **Animated Visuals:** Smooth crossfade transitions, progress bar shimmer, and a dynamic, color-matched ambient background and album art glow based on the current track's album art.
  * **Full Playback Controls:** Integrated buttons for Play/Pause, Skip Next, Skip Previous, and Volume Control (requires Spotify Premium and an active device).
  * **Device Status:** Shows the connected device and its online/offline status.
  * **Fullscreen Mode:** Dedicated fullscreen button and keyboard shortcut (`F` or `f`).
  * **Keyboard Shortcuts:** Control playback with the spacebar, and toggle fullscreen with `F`.
  * **Secure PKCE Authentication:** Uses modern, secure Proof Key for Code Exchange (PKCE) for Spotify authorization without exposing a client secret.

## 👀 Preview

![SpotDeck Preview1](Images/preview1.png)

![SpotDeck Preview2](Images/preview2.png)

## 🛠️ Setup Instructions (GitHub Pages & Private Repo)

To host your SpotDeck securely using GitHub Pages from a private repository, you need to set up a Spotify Developer Application and configure the deployment.

### Step 1: Create a Spotify Developer Application

1.  Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/).
2.  Click **Create app**.
3.  Fill in the App Name (e.g., `SpotDeck`), Description, and check the box for `Web API`.
4.  Click **Create**.
5.  In your new app's settings, find the **Client ID** and keep it handy.
6.  Click **Edit Settings**.
7.  Under **Redirect URIs**, add the following URL. This URL is crucial and must exactly match the path of your GitHub Pages site:
    ```
    https://<YOUR-GITHUB-USERNAME>.github.io/<YOUR-REPO-NAME>/
    ```
    *Example: `https://johndoe.github.io/spotdeck-display/`*
8.  Click **Add** and then **Save**.

### Step 2: Configure Your GitHub Repository

1.  **Create a New Private Repository** on GitHub (e.g., `spotdeck-display`).
2.  **Upload the `index.html` file** (the provided file) to the root of this new repository.

### Step 3: Insert Your Client ID

1.  Open the `index.html` file in your GitHub repository editor (or locally).
2.  Find the line near the top of the `<script>` tag:

    ```
    const SPOTIFY_CLIENT_ID = "YOUR_SPOTIFY_CLIENT_ID_HERE";
    ```
    
4.  **Replace** `"YOUR_SPOTIFY_CLIENT_ID_HERE"` with the actual **Client ID** you obtained in Step 1.
5.  **Commit** the changes to your repository.

### Step 4: Configure GitHub Pages Deployment

To enable GitHub Pages on a **private** repository, you must use a specific setup, typically deploying from the `main` branch.

1.  In your GitHub repository, go to **Settings**.
2.  In the left sidebar, click **Pages**.
3.  Under **Build and deployment**, select:
      * **Source:** **Deploy from a branch**
      * **Branch:** Select the **`main`** branch and the **`/ (root)`** folder.
4.  Click **Save**.
5.  GitHub will now deploy your site. This may take a few minutes. Once deployed, the URL will be displayed on this page (it will be the same URL you entered as the Redirect URI in Step 1).

### Step 5: Final Authorization

1.  Navigate to your deployed GitHub Pages URL (e.g., `https://<YOUR-GITHUB-USERNAME>.github.io/<YOUR-REPO-NAME>/`).
2.  Click the **Connect Spotify** button.
3.  You will be redirected to the Spotify login page to authorize the application.
4.  After authorization, you will be redirected back to your SpotDeck display, and it will begin showing your current playback status.

## 💻 Keyboard Shortcuts

| Key | Action | Notes |
| :--- | :--- | :--- |
| **Space** | Play/Pause | Only works when the Settings Modal is closed. |
| **F** / **f** | Toggle Fullscreen | |
| **Escape** | Close Settings Modal | |
| **V** / **v** | Toggle Visualizer | |

## ⚠️ Requirements

  * **Spotify Premium:** Playback control functions (Play/Pause, Skip, Volume) require a **Spotify Premium** subscription due to Spotify API restrictions.
  * **Playback device:** Use another active Spotify Connect device in controller mode, or start the local browser player described below.

## Browser playback and Vibe Face settings

Open **Einstellungen → Wiedergabe**:

- **Andere Geräte steuern** keeps the existing controller mode. Choose an available Spotify Connect device in the device list to transfer the current playback; its play/pause state is preserved.
- **Auf diesem Gerät abspielen** prepares the official Spotify Web Playback SDK. Existing controller logins remain valid, but local playback requires reconnecting once to grant `streaming`, `user-read-email` and `user-read-private`. Then choose local playback again and press **Auf diesem Gerät starten**. No browser playback starts merely by opening the settings.
- Spotify Premium, HTTPS and browser support for protected media are required. The Spotify developer app must be configured for the Web Playback SDK. A local-device registration or mock test alone does not prove audible playback on a particular device.
- If playback is blocked by autoplay rules, press the start button again. On some systems, especially iOS, volume is controlled on the device itself.
- TV browsers are not guaranteed to support Spotify DRM, even if ordinary video works. When unsupported, keep controller mode or run SpotDeck on a mini-PC connected to the TV by HDMI.

The SDK is loaded only when local playback is requested. Tokens stay in the existing PKCE/session flow; no client secret or account credentials are embedded. A shared refresh operation prevents competing token refreshes. Logout disconnects the local player.

**Einstellungen → Vibe-Face-Bewegung** offers Systemstandard, Reduzierte Bewegung, Normale Animation and Lebhafte Animation. The default follows the operating system; explicitly choosing Normal or Lively overrides its reduced-motion preference. Reduced mode limits head movement while keeping expressions, lyrics and interactions available.

Vibe Face uses one animation loop for idle behaviour, dance, lyric mouth movements and the Easteregg. The loop pauses in hidden tabs and updates at approximately 30 fps (15 fps in reduced mode). It occasionally looks around, daydreams, yawns, crosses its eyes or briefly stumbles and recovers while dancing. These are original character gestures, inspired by playful small companions, not copied assets.

Single taps vary between shy, cheeky, happy and surprised reactions; shorter multi-tap sequences produce confused or playfully annoyed reactions. **Five taps/clicks** within 2.6 seconds, with gaps no longer than 650 ms, trigger seven seconds of Vibe Overdrive. Dragging, long presses, multi-touch and duplicate synthetic clicks do not count. Enter/Space on the focused face also work.

Optional quiet interaction sounds are disabled by default. Enable **Leise Fantasiegeräusche** to hear short, rate-limited electronic chirps. They use a separate low-volume audio source and do not process Spotify audio.

Lyrics-based singing remains an approximation from synchronized LRC line times, not phoneme or live-audio analysis. Without synchronized lyrics, idle expressions and dance still work. Tempo/energy use Spotify audio features when accessible; otherwise a default tempo is used.

### Verification

Run the dependency-free, offline integration checks with:

```sh
node tests/spotdeck.test.cjs
```

They cover reduced-motion overrides, idle animation, one RAF loop, hidden-tab suspension, mouse/touch fallback, ghost clicks, the five-tap Easteregg, simulated SDK initialization and commands, transfer requests, metadata, library playback, scope upgrade and DRM/account fallback. No real account or token is used.

On 2026-10-29 the actual Chromium-based in-app browser was checked at desktop and 844 × 390 viewports: settings, explicit normal motion with OS reduction enabled, idle reactions and five real mouse clicks passed. Firefox native automation was stopped by the testing tool's URL-policy limitation at its profile chooser. Separate Chrome/Edge, Safari, iOS, Android, smart-TV hardware and audible Premium playback have **not** been certified by these checks and need a device/account test.

Official references: [Web Playback SDK](https://developer.spotify.com/documentation/web-playback-sdk), [SDK reference and autoplay activation](https://developer.spotify.com/documentation/web-playback-sdk/reference), [required player scopes](https://developer.spotify.com/documentation/web-playback-sdk/howtos/web-app-player/).

## 📃 License

MIT License © 2025 Sayan Sarkar

## 🤝 Contributions 
Special Thanks To [Shitij](https://github.com/ShitijHalder) For The Overall Help.
