## Simple Irc Client core

[![Build Status](https://github.com/Simple-Irc-Client/core/actions/workflows/ci.yml/badge.svg)](https://github.com/Simple-Irc-Client/core/actions/workflows/ci.yml)

This is a web-based IRC client application developed using React that connects directly to IRC servers using WebSocket.

## Tech Stack

- [React 19](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Zustand](https://github.com/pmndrs/zustand) - State management
- [ws](https://github.com/websockets/ws) - WebSocket client
- [shadcn/ui](https://ui.shadcn.com/) - UI components
- [Radix UI](https://www.radix-ui.com/) - Headless UI primitives
- [i18next](https://www.i18next.com/) - Internationalization

## Requirements

- Node.js >= 24

## Usage

### Development

Start the development server:

```bash
npm install
npm run dev
```

The application will be available at `http://localhost:5173`

### Docker

Run using Docker:

```bash
docker build -t simple-irc-client .
docker run -p 5173:5173 simple-irc-client
```

## Contributing
If you find a bug or would like to contribute to the project, please open an issue or submit a pull request on GitHub.

## License
This project is licensed under the [Affero General Public License version 3 (AGPLv3)](https://github.com/Simple-Irc-Client/core/blob/main/LICENSE).

## Authors

- [Piotr Luczko](https://www.github.com/piotrluczko)
- [Dariusz Markowicz](https://www.github.com/dmarkowicz)

