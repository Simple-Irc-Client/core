# Simple IRC Client

[![Build Status](https://github.com/Simple-Irc-Client/core/actions/workflows/ci.yml/badge.svg)](https://github.com/Simple-Irc-Client/core/actions/workflows/ci.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/Simple-Irc-Client/core/badge)](https://scorecard.dev/viewer/?uri=github.com/Simple-Irc-Client/core)

An IRC client for the browser and desktop. Chat on Libera.Chat, OFTC or any other IRC network, with end-to-end encrypted private messages.

![Screenshot](https://raw.githubusercontent.com/Simple-Irc-Client/.github/main/profile/screenshot.png)

**[Open the web chat](https://app.simpleircclient.com/)** (no install, no account) or **[download the desktop app](https://simpleircclient.com/downloads.html)**.

This repository is the app itself, shared by the web chat and the desktop app.

## Features

- Encrypted private messages between Simple IRC Client users
- Stays connected when your phone puts the tab in the background
- Replies, emoji reactions and multi-line messages
- Chat history: scroll up for older messages, search with Ctrl+Shift+F
- Highlight words, mention sounds and `/ignore`
- Gets your nick back when it is free
- soju bouncer support
- Light and dark mode, built-in and custom CSS [themes](https://simpleircclient.com/themes.html)
- Keyboard shortcuts: Ctrl+K switches windows, Ctrl+/ lists them all
- Embeddable on your website with an iframe ([URL parameters](docs/query-params.md))

More details:
- [How encryption works](docs/e2ee.md)
- [How sessions survive a backgrounded tab](docs/resumable-sessions.md)

## Development

```bash
pnpm install
pnpm run dev       # http://localhost:5173
pnpm test          # unit tests
pnpm run test:e2e  # Playwright, against IRC servers in Docker
```

The e2e tests run every spec twice: on ergo (IRCv3) and through the gateway on ngircd (no IRCv3). They need a [gateway](https://github.com/Simple-Irc-Client/gateway) checkout next to this repository (`../gateway`, with `pnpm install` done), or `E2E_GATEWAY_DIR` pointing to one.

With Docker:

```bash
docker build -t simple-irc-client .
docker run -p 5173:5173 simple-irc-client
```

## Contributing

Found a bug or have an idea? [Open an issue](https://github.com/Simple-Irc-Client/core/issues).

## License

[AGPL-3.0](LICENSE). Authors: [Piotr Łuczko](https://www.github.com/piotrluczko), [Dariusz Markowicz](https://www.github.com/dmarkowicz).
