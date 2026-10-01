## Simple Irc Client core

[![Build Status](https://github.com/Simple-Irc-Client/core/actions/workflows/ci.yml/badge.svg)](https://github.com/Simple-Irc-Client/core/actions/workflows/ci.yml)

A React IRC client that connects to IRC servers directly over WebSocket.

## Features

- Direct WebSocket connection, no backend required
- Responsive UI (Tailwind CSS, shadcn/ui), light and dark mode
- Built-in themes (classic, modern, irc) and custom CSS themes
- English and Polish translations (i18next)
- IRCv3: SASL, STS, chathistory, typing, metadata, MONITOR and more
- End-to-end encrypted private messages (SIC-E2EE v1, described below)

## End-to-End Encryption (E2EE)

SIC-E2EE v1 encrypts private messages between clients without any server-side support. It uses WebCrypto only, with no third-party crypto library.

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

- **Forward Secrecy**: Per handshake, not per message (no ratchet); compromising a long-term identity key does not decrypt past sessions
- **Authentication**: Long-term identity keys bind the session to specific peers
- **TOFU Pinning**: First-seen identity keys are pinned; changed keys block the session and warn the user
- **Fingerprint Verification**: Users can compare 64-bit fingerprints (shown as NATO phonetic alphabet words) out-of-band to detect MITM at first contact
- **No Silent Downgrade**: If encryption was previously established with a peer, dropping back to plaintext shows a warning

### Identity Management

- Each **IRC network** has its own identity key pair
- Identity keys are **non-extractable** CryptoKey objects stored in IndexedDB via structured clone
- Private keys are never exposed as raw bytes to JavaScript, so they cannot be exported or copied out
- Fingerprints are displayed as 16 NATO phonetic alphabet words, one per hex nibble (e.g., `Zero One Two Three Four Five Six Seven Eight Nine Alpha Bravo Charlie Delta Echo Foxtrot`) — internationally standard and unambiguous to read aloud

### Message Handling

- **Chunking**: Large messages split into multiple IRC lines (frame size follows the server's LINELEN, 320 base64 chars by default; max 16 frames)
- **Reassembly**: Out-of-order chunks are buffered and reassembled within 120 seconds of the first chunk
- **Message Types**: Regular messages (`m`) and actions/CTCP ACTION (`a`) are preserved through encryption
- **No Plaintext Leak**: Even `/me` actions are encrypted, not sent as cleartext ACTION

### Rate Limiting

- Inbound OFFER frames throttled to **1 per peer per second**
- RESET replies throttled to 1 per peer per 10 seconds
- Tracked peers and pending frames are capped, so memory use stays bounded

### User Experience

The encryption state is always visible:

- **Lock icon** in conversation header shows encryption status
- **Banners** appear for handshake prompts, key-mismatch warnings, and errors — an unverified-but-encrypted session is the expected TOFU default and stays quiet, with verification discoverable in the lock popover instead of nagging
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

