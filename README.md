## Simple Irc Client core

[![Build Status](https://github.com/Simple-Irc-Client/core/actions/workflows/ci.yml/badge.svg)](https://github.com/Simple-Irc-Client/core/actions/workflows/ci.yml)

This is a web-based IRC client application developed using React that connects directly to IRC servers using WebSocket.

## Features

- **Direct Connection** - Connect to IRC servers directly via WebSocket without a backend service
- **Modern UI** - Clean, responsive interface built with Tailwind CSS and shadcn/ui
- **Dark Mode** - Beautiful dark theme with OKLCH color space
- **Internationalization** - Multi-language support with i18next
- **Channel Management** - Easy channel navigation and management
- **User Interaction** - Private messages, WHOIS, and context menus

## Getting Started

### Installation

```bash
pnpm install
```

### Development

Start the development server:

```bash
pnpm run dev
```

The application will be available at `http://localhost:5173`

### Docker

Run using Docker:

```bash
docker build -t simple-irc-client .
docker run -p 5173:5173 simple-irc-client
```

The application will be available at `http://localhost:5173`

## Related Projects

- [Simple-Irc-Client](https://github.com/Simple-Irc-Client) - Main project organization

## Contributing
If you find a bug or have a feature request, please [open an issue](https://github.com/Simple-Irc-Client/core/issues) on GitHub.

## License

This project is licensed under the [GNU Affero General Public License v3.0 (AGPL-3.0)](https://github.com/Simple-Irc-Client/core/blob/main/LICENSE).

The AGPL-3.0 license ensures that if you modify and deploy this software over a network, you must make the complete source code available to users.

**Authors:**

- [Piotr Łuczko](https://www.github.com/piotrluczko)
- [Dariusz Markowicz](https://www.github.com/dmarkowicz)

