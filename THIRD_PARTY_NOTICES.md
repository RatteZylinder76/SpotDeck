# js-yaml 4.3.2

The standalone `index.html` embeds the unmodified `dist/js-yaml.min.js` browser distribution from the official npm release `js-yaml@4.3.2`.

- Upstream tag: <https://github.com/nodeca/js-yaml/tree/4.3.2>
- Upstream commit and npm `gitHead`: `79ca68d90f333fbe6d9e42827527e62636200191`
- Release package: <https://registry.npmjs.org/js-yaml/-/js-yaml-4.3.2.tgz>
- Embedded distribution size: 43,644 bytes.
- SHA-256 of the exact embedded distribution bytes, including its source-map comment and trailing newline: `32391560601990bb6e0daabd8106a35a6a539de088532413931a70a4cb4f4769`.

The downloaded release tarball was verified against the npm registry's SHA-512 integrity value before extracting the distribution, license and package metadata. Its `gitHead` matches the fixed upstream tag. No package installation or build hooks were run. Upstream stopped committing generated `dist/` files in 4.2.0, so the published npm package supplies the official browser build.

This update adds upstream parser hardening. SpotDeck retains its JSON schema and bounded-input validation; the update does not assert that a known advisory was exploitable through SpotDeck.

(The MIT License)

Copyright (C) 2011-2015 by Vitaly Puzrin

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
