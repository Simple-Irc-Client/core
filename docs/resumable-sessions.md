# Resumable Gateway Sessions

Built in gateway mode, the app asks the [gateway](https://github.com/Simple-Irc-Client/gateway) for a resumable session. When the WebSocket drops (a phone puts the tab in the background), the gateway keeps the IRC connection and buffers what arrives. When the tab is visible again, the app reconnects with the session token and the number of the last line it saw, skips registration, and receives exactly the lines it missed. Channels, nick and negotiated capabilities stay as they were, and other users see no quit or rejoin.

- If the gateway no longer has the session (it expired or the gateway restarted), the same connection registers from scratch.
- After a page reload the app cannot resume, so it asks the gateway to end the old session and starts a new one.
- Disconnecting from the menu, or `/quit`, sends QUIT so the gateway ends the session right away.
- Encrypted conversations carry on: the peer never saw the connection end, so the session keys are kept and missed encrypted messages are decrypted from the replay.
- When some missed lines were dropped from the gateway's buffer, the app says so, refreshes the user lists of open channels and ends encrypted sessions, since a lost QUIT could mean someone else now holds a peer's nick; they are re-offered once presence reports the peer.
- It works the same on servers without IRCv3: the gateway adds the time it received each line to replayed lines that have no server-time.

The protocol is described in the [gateway's README](https://github.com/Simple-Irc-Client/gateway#resumable-sessions).
