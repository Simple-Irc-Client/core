# URL Query Parameters

The IRC client supports URL query parameters to pre-configure the connection and skip wizard steps.

## Available Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `server` | string | Server to connect to (network name, hostname, or hostname:port) |
| `port` | number | Port number (1-65535), overrides port in server param |
| `tls` | boolean | Enable/disable TLS encryption (`true`, `false`, `1`, `0`) |
| `channel` | string | Channel(s) to auto-join after connecting (comma-separated) |

## Parameter Details

### server

The `server` parameter can be:
- **Known network name** (case-insensitive): `Libera.Chat`, `OFTC`, `EFnet`, `IRCNet`, `Rizon`, `QuakeNet`, etc.
- **Custom hostname**: `irc.example.com`
- **Hostname with port**: `irc.example.com:6697`
- **Full URI with protocol**: `ircs://irc.example.com:6697`

**Supported protocol prefixes:**
| Protocol | Connection Type | TLS |
|----------|----------------|-----|
| `irc://` | Backend (direct) | No |
| `ircs://` | Backend (direct) | Yes |
| `ws://` | WebSocket | No |
| `wss://` | WebSocket | Yes |

When provided, the wizard skips the server selection step and connects automatically after the user enters their nick.

### port

The `port` parameter specifies a custom port number. Only used for custom hostnames (known networks use their predefined ports).

- Valid range: 1-65535
- Common ports: `6667` (plain), `6697` (TLS)
- Overrides port specified in `server` parameter if both are provided

### tls

The `tls` parameter controls TLS/SSL encryption:
- `true` or `1`: Enable TLS
- `false` or `0`: Disable TLS
- Not specified: Uses network default (or `false` for custom servers)

For known networks, this overrides the network's default TLS setting.

### channel

The `channel` parameter specifies which channel(s) to join after connecting. When provided, the wizard skips the channel list step.

- **Single channel**: `channel=%23general`
- **Multiple channels**: `channel=%23general,%23help,%23random` (comma-separated)

**Important:** The `#` character must be URL-encoded as `%23`, or placed at the end of the URL where browsers interpret it as a fragment.

## Examples

### Basic Examples

```
# Connect to Libera.Chat (known network)
?server=Libera.Chat

# Connect to custom server
?server=irc.example.com

# Connect and join a channel
?server=Libera.Chat&channel=%23general

# Connect and join multiple channels
?server=Libera.Chat&channel=%23general,%23help,%23random
```

### With Port

```
# Custom server with non-standard port (using port param)
?server=irc.example.com&port=7000

# Custom server with port in server param
?server=irc.example.com:7000

# Custom server with TLS port
?server=irc.example.com:6697&tls=true
```

### With Protocol Prefix

```
# IRC with TLS (ircs://)
?server=ircs://irc.secure.com:6697

# IRC without TLS (irc://)
?server=irc://irc.example.com:6667

# WebSocket with TLS (wss://)
?server=wss://irc.websocket.com:443

# WebSocket without TLS (ws://)
?server=ws://irc.websocket.com:8080
```

### With TLS

```
# Force TLS on custom server
?server=irc.example.com&tls=true

# Using protocol prefix (equivalent)
?server=ircs://irc.example.com

# Force TLS off for known network (not recommended)
?server=Libera.Chat&tls=false

# Custom server with TLS on standard TLS port
?server=irc.example.com:6697&tls=1
```

### Complete Examples

```
# Connect to Libera.Chat and join #general
?server=Libera.Chat&channel=%23general

# Connect to custom server with TLS and join multiple channels
?server=irc.example.com:6697&tls=true&channel=%23help,%23support

# Connect using ircs:// protocol and join channels
?server=ircs://irc.secure.com:6697&channel=%23secure

# Connect via WebSocket and join channel
?server=wss://irc.websocket.com&channel=%23websocket

# Connect to OFTC and join #debian
?server=OFTC&channel=%23debian
```

### Full URL Examples

```
https://irc.example.com/?server=Libera.Chat
https://irc.example.com/?server=Libera.Chat&channel=%23general,%23help
https://irc.example.com/?server=irc.pirc.pl:6697&tls=true&channel=%23help
https://irc.example.com/?server=ircs://irc.secure.com:6697&channel=%23secure
https://irc.example.com/?server=wss://irc.websocket.com:443&channel=%23chat
```

## Alternative Channel Syntax

Since `#` is interpreted as a URL fragment by browsers, you can also use this syntax for a single channel:

```
# Using fragment (browser interprets # as fragment identifier)
?server=Libera.Chat&channel=#general

# This works because the app falls back to reading the URL fragment
```

However, URL-encoding (`%23`) is the recommended approach for reliability, especially when joining multiple channels.

## Behavior

1. **No parameters**: Normal wizard flow (nick → server → channels)
2. **server only**: Skip server selection (nick → loading → channels)
3. **server + channel**: Skip server and channel selection (nick → loading → connected)
4. **server + port/tls**: Custom connection settings for the server
5. **Multiple channels**: All specified channels are joined automatically
