# Subscription format

A subscription is a URL the user pastes into the client. The client reads servers from the body,
everything else from the response headers, and re-fetches on an interval.

## Supported protocols

| Protocol | Scheme | Carried by |
|---|---|---|
| VLESS | `vless://` | xray, mihomo |
| Trojan | `trojan://` | xray, mihomo |
| Shadowsocks | `ss://` | xray, mihomo |
| Hysteria2 | `hysteria2://`, `hy2://` | mihomo only |
| AmneziaWG | `awg://`, or a raw `.conf` in the body | its own engine |
| WireGuard | a raw `.conf` in the body | its own engine |

**Not supported:** `vmess://`, `socks://`, `socks5://`, `http://` proxies, `ssr://`, `tuic://`,
`hysteria://` (version 1 — only Hysteria 2 is carried), and `wireguard://`. A WireGuard config arrives as a
`.conf`, not as a link.

An unsupported line is reported to the user as a skipped entry, and the rest of the subscription
loads normally.

### One Hysteria2 entry changes the engine for the whole subscription

A subscription's servers connect as one group, and a group runs on one engine: the one that can carry
every protocol in it. Hysteria2 is carried only by mihomo, so mixing VLESS with a single Hysteria2
server moves **all** of it from xray to mihomo.

The engines accept different options: `mux` and `xudp` are xray-only, and the available uTLS
fingerprints and balancer strategies differ. If your VLESS servers are tuned for xray, serve
Hysteria2 as a separate subscription.

## Body formats

| Body | Read as |
|---|---|
| Base64 | The whole body, base64-encoded, decoding to one link per line. URL-safe base64 (`-` and `_`) and missing padding are both accepted |
| Plain text | One link per line. Blank lines are ignored |
| Clash / mihomo YAML | A `proxies:` document, read for its server list. Clash routing (`rules:`, `proxy-groups:`) is not translated — deliver routing through a [routing profile](routing.md) |
| A raw WireGuard or AmneziaWG `.conf` | One server. AmneziaWG is recognised by its obfuscation parameters (`Jc`, `Jmin`, `Jmax`, `S1`–`S4`, `H1`–`H4`, `I1`–`I5`) |

A body containing `[Interface]` anywhere is read entirely as one `.conf`, so a config cannot be mixed
with links. To serve several AmneziaWG locations, use one `awg://` line per server.

## Server names

Names come from the URL fragment, which is decoded, so `#🇩🇪 Germany` and
`#%F0%9F%87%A9%F0%9F%87%AA%20Germany` both arrive correctly.

The first flag emoji anywhere in the name selects the server's country icon; other emoji stay as
text. Only real regional-indicator pairs count, not two-letter prefixes: `US` inside `RUSSIA` would
otherwise match.

There is no provider icon and no icon URL: nothing is fetched to render a subscription. Use emoji in
the title to stand out.

## Metadata

Every parameter below arrives as an HTTP response header or as a body line prefixed with `#`. The
header wins over the body, and in-body lines never appear in the server list.

=== "Headers"

    ```http
    HTTP/1.1 200 OK
    profile-title: My VPN
    subscription-userinfo: upload=0; download=2153701362; total=107374182400; expire=1790951622
    profile-update-interval: 12
    support-url: https://t.me/example_support
    profile-web-page-url: https://example.com/account
    ```

=== "In the body"

    ```
    #profile-title: My VPN
    #subscription-userinfo: upload=0; download=2153701362; total=0; expire=1790951622
    vless://uuid@server1.example.com:443#🇩🇪 Germany
    ```

| Parameter | Value | Effect |
|---|---|---|
| `profile-title` | text or `base64:…` | The name users see; subscriptions cannot be renamed. It shares a row with the traffic bar and is truncated to fit, so target 25 characters |
| `subscription-userinfo` | `key=value; …` | Traffic and expiry, below |
| `profile-update-interval` | whole hours | How often to re-fetch. Out-of-range values fall back to the client's own interval. Not a polling channel — a subscription is a server list |
| `support-url` | URL | Adds a support button to the subscription header. An invalid URL hides the button |
| `profile-web-page-url` | URL | Adds an account or website button. Same validation |
| `routing` | base64 or a link | A [routing profile](routing.md) |
| `new-url` | URL | The subscription has moved. The user confirms before the stored URL changes |
| `new-domain` | host | The same, replacing only the host |
| `fallback-url` | URL | Tried when the primary URL fails. Not stored and not confirmed — a read fallback only |

`base64:` values are decoded as UTF-8; a value that fails to decode is used verbatim.
`subscription-name`, `homepage` and `content-disposition` are accepted as fallbacks for
`profile-title` and `profile-web-page-url`.

Set both `support-url` and `profile-web-page-url`. When a refresh is rejected or payment is required,
the status line tells the user to contact you, and those buttons are the only way to. See
[Responses and errors](responses.md).

### Traffic and expiry

```
subscription-userinfo: upload=0; download=2153701362; total=107374182400; expire=1790951622
```

| Field | Meaning |
|---|---|
| `upload`, `download` | Bytes. The client shows **upload + download** as used traffic |
| `total` | Byte limit. `0` means unlimited, and the bar renders as unmetered rather than as full |
| `expire` | Unix seconds. A value above `32000000000` is read as milliseconds |

Used traffic at or over `total` turns the bar and its label red. An `expire` in the past marks the
subscription expired. Neither stops anything: the servers stay usable until you stop serving them.
`subscription-userinfo: 0` hides the traffic block entirely.

## The request the client makes

```http
GET /your/path HTTP/1.1
User-Agent: GlitchVPN/<version> (<platform>)
Accept: */*
x-hwid: <random uuid, generated when the app was installed>
```

No device model, no OS version, no locale, no hardware fingerprint. The user can switch `x-hwid` off;
a subscription cannot switch it on. Reinstalling produces a new identifier, and two installs on one
machine are two identifiers. See [Identifying devices](devices.md).

## Failure behaviour

One bad entry never discards the batch: unparseable lines are reported individually with the reason,
and every valid server still loads.

A failed fetch keeps the previous server list, and the header shows the last successful update.
[Responses and errors](responses.md) covers which status codes end a subscription, which are retried,
and what the user is told in each case.
