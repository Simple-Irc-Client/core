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
- **End-to-End Encryption (E2EE)** - Secure private conversations with SIC-E2EE v1 protocol

## End-to-End Encryption (E2EE)

SIC-E2EE v1 provides encrypted private messaging directly between clients without any server-side infrastructure. The encryption is built on web standards (WebCrypto) and works in modern browsers.

### Protocol Overview

The protocol uses a **Noise-like handshake** with **Triple Diffie-Hellman (3DH)** for authentication and forward secrecy:

- **Key Exchange**: ECDH P-256 (chosen for broad WebCrypto compatibility across desktop webviews)
- **Encryption**: AES-256-GCM with 12-byte nonces
- **Key Derivation**: HKDF-SHA256 with a transcript hash as salt
- **Message Format**: CTCP-based, graceful degradation (non-SIC clients see nothing)

### Handshake Flow

```
Alice (Initiator)                          Bob (Responder)
      |                                        |
      |--- SIC-E2EE OFFER 1 <idKey> <ephKey> --->
      |                                        |
      |<---- SIC-E2EE ACCEPT 1 <idKey> <ephKey> ---
      |                                        |
      [Both derive session keys]              [Both derive session keys]
      |                                        |
      |--- SICE <frameId> 1/1 <ciphertext> ---->
      |                                        |
```

The handshake produces:
- **Three DH operations** mixed into IKM: DH(ephA,ephB) + DH(idA,ephB) + DH(ephA,idB)
- **Transcript hash** over all four public keys as HKDF salt
- **Separate send/recv keys** derived with different info labels (`sic-e2ee-v1 i2r` / `sic-e2ee-v1 r2i`)

### Security Properties

- **Forward Secrecy**: Ephemeral keys rotate per conversation; compromising a long-term identity key does not decrypt past sessions
- **Authentication**: Long-term identity keys bind the session to specific peers
- **TOFU Pinning**: First-seen identity keys are pinned; changed keys block the session and warn the user
- **Fingerprint Verification**: Users can compare 64-bit fingerprints out-of-band to detect MITM at first contact
- **No Silent Downgrade**: If encryption was previously established with a peer, dropping back to plaintext shows a warning

### Identity Management

- Each **IRC network** has its own identity key pair
- Identity keys are **non-extractable** CryptoKey objects stored in IndexedDB via structured clone
- Private keys never exist as raw bytes in JavaScript, protecting against XSS
- Fingerprints are displayed as space-separated 4-character groups (e.g., `4F2A 91BC E07D 22A1`)

### Message Handling

- **Chunking**: Large messages split into multiple IRC lines (max 320 base64 chars per frame, max 16 frames)
- **Reassembly**: Out-of-order chunks are buffered and reassembled with a 30-second TTL
- **Message Types**: Regular messages (`m`) and actions/CTCP ACTION (`a`) are preserved through encryption
- **No Plaintext Leak**: Even `/me` actions are encrypted, not sent as cleartext ACTION

### Rate Limiting

- Inbound OFFER frames throttled to **1 per peer per second** to prevent handshake flooding
- Limits the cost of concurrent handshakes and prevents memory exhaustion attacks

### User Experience

The encryption state is always visible:

- **Lock icon** in conversation header shows encryption status
- **Banners** appear for handshake prompts, verification warnings, and errors
- **Color coding**:
  - Green lock = Encrypted & verified
  - Yellow lock = Encrypted but unverified
  - Red shield = Key mismatch / security issue
  - Open lock = No encryption (with warning if previously encrypted)

Users can:
- Start encryption with any peer via the lock button menu
- Accept or decline incoming encryption requests
- View and compare fingerprints in the lock popover
- Mark a peer as verified after out-of-band fingerprint comparison
- End active encryption sessions

### Privacy Features

- **Per-network identities**: Prevents correlation of the same user across different IRC networks
- **No history storage**: Encrypted messages are **not** persisted to IndexedDB; only plaintext messages are stored
- **Session binding to nicks**: If a peer changes nick, the session is dropped (not automatically transferred)

### Wire Format

All E2EE traffic uses CTCP (Client-To-Client Protocol):

```
Handshake:
  SIC-E2EE OFFER 1 <identityKeyB64> <ephemeralKeyB64>  (PRIVMSG)
  SIC-E2EE ACCEPT 1 <identityKeyB64> <ephemeralKeyB64> (NOTICE)
  SIC-E2EE DECLINE                                    (NOTICE)
  SIC-E2EE RESET                                      (NOTICE)

Encrypted messages:
  SICE <frameId> <index>/<total> <base64Chunk>         (PRIVMSG)
```

CTCP was chosen because unknown CTCP verbs are silently ignored by other IRC clients, providing graceful degradation.

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

