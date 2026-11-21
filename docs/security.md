# Security review, November 2026

This review covers the repository and passive requests to the public GitHub Pages site. Reproductions use offline mocks and small harmless fixtures; no user tokens, real account attacks, intrusive scans or audio uploads were used. It is a focused source review, not a guarantee that every vulnerability has been found.

SpotDeck is a static browser application hosted by GitHub Pages. It has no application server or database of its own: the browser communicates directly with Spotify and the public metadata services. Its important attack surfaces are therefore browser authorization, executable dependencies and untrusted external or imported data.

## Findings and changes

### Logout could be undone by a late authorization response

An already-running refresh could save credentials after the user disconnected Spotify. A waiting API call could then continue with those credentials. The reproduction used a mocked token response and established session restoration after logout; it did not demonstrate theft of a user's credentials. Authorization responses and API requests are now bound to the current session generation and stored session. Logout invalidates pending work, and old unauthorized responses cannot delete a newer session. Invalid OAuth callback parameters no longer discard a valid existing session. Callback values are removed from the address before asynchronous exchange.

PKCE with S256 and the correlated state value remain in place. The browser client identifier is public configuration, not a client secret. See [Spotify's PKCE documentation](https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow).

### Oversized and amplified lyric input could freeze the page

Some provider JSON bodies were read without a size bound. Separately, YAML flow anchors bypassed the old textual anchor check: a harmless 2,590-character fixture expanded to 500,000 lyric characters. This was a client resource-exhaustion finding, not evidence of JavaScript execution or server compromise.

Provider bodies now have byte limits before JSON/YAML parsing, with stream cancellation when the limit is exceeded. Declared oversized Content-Length is rejected early. Browsers without readable response streams retain a bounded post-read fallback; that fallback cannot prevent the browser from first buffering the body. Provider, cache and local-import paths also enforce field and aggregate lyric limits. Actual YAML anchor detection, parser depth/node budgets and JSON_SCHEMA replace reliance on the incomplete anchor regular expression. Ordinary stars and ampersands in text remain usable.

### Old pages unnecessarily expanded the trusted script surface

The two legacy HTML players shared the same origin and browser storage as the active application. One still loaded an unpinned third-party script. Both are now script-free redirects to the current player, with a visible fallback link. No third-party compromise was observed; this removes an unnecessary route for one.

The active player keeps the fixed official Spotify SDK loader needed for local playback. YAML is bundled locally and has been updated to the official 4.3.2 browser distribution. Its precise source, version and checksum are recorded in [third-party notices](../THIRD_PARTY_NOTICES.md). The downloaded npm package's integrity matched registry metadata and its gitHead matched the fixed upstream tag; no installation hooks were executed. No private keys or recognized service-secret patterns were found in the reviewed source. This observation is not an audit of the owner's GitHub account, other repositories or browser extensions.

## Browser protections and hosting limits

The main page uses a no-referrer policy and blocks base-URL replacement and embedded plugin objects. These directives preserve the existing Spotify SDK, protected playback, local audio and dynamic styles. The standalone mouth comparison has no network dependency and uses a restrictive content policy with hashes for its exact inline scripts. Release preparation regenerates and verifies those hashes. A stale release number or script hash fails the release check.

Lyric and user-text rendering was checked for HTML injection; the tested paths escape text or use textContent. No working DOM-XSS or global prototype-pollution exploit was found in the probes. This does not mean that every possible input or dependency path is safe.

Refresh tokens remain in browser storage to preserve the existing sign-in behavior. Executable code on the same origin, a malicious browser extension or a compromised browser profile can still access them. A script hash on the offline preview is not protection for every script on the main player. Moving credentials behind an HttpOnly session would require a backend and a different deployment design.

GitHub Pages does not provide arbitrary response-header configuration for this repository. In particular, clickjacking protection through frame-ancestors or X-Frame-Options needs HTTP headers; frame-ancestors in a meta tag would not work. The review therefore does not claim that framing is prevented. See [MDN on frame-ancestors](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors).

## Verification

All 24 offline integration suites pass, including the new authentication, input-security, browser-policy and release-version regressions, as well as existing playback, lyrics, seasonal animation, mobile-layout and mouth tests. The release workflow checks both the metadata and these suites using read-only repository permissions and pinned official actions. Live release checks compare the exact published HTML bytes with the tested files; they establish deployment identity, not physical-device playback quality or absence of all vulnerabilities.
