# Deep links

A deep link hands the client something to import. Put it in a bot, on a page or in a QR code. The
scheme is `glitchvpn://`.

Every import asks the user to confirm. The link opens a sheet showing what will be added, and nothing
is stored until they accept. No parameter skips the sheet.

| Link | Effect |
|---|---|
| `glitchvpn://add/<url>` | Add a subscription by URL |
| `glitchvpn://import/<data>` | Detect what `data` is — a subscription URL, one link, several links, or a raw `.conf` |
| `glitchvpn://routing/add/<base64>` | Attach a [routing profile](routing.md) |

```
glitchvpn://add/https://sub.example.com/abc123token
glitchvpn://import/vless://uuid@server.example.com:443?security=reality&sni=example.com#🇩🇪 Germany
glitchvpn://routing/add/eyJ2ZXJzaW9uIjoxLCJuYW1lIjoiZXhhbXBsZSJ9
```

`<data>` may be percent-encoded or base64. Base64 a raw `.conf`: a multi-line INI does not survive
most places a link gets pasted.

A bare protocol link works too. Paste `vless://…` into the add sheet, or open it if the system routes
it to the client.

## No control links

`connect`, `disconnect` and `toggle` are not part of the scheme. A page that controls the tunnel can
uncover the user's real address, or choose which subscription carries their traffic.

## No encrypted links

The client cannot import an obfuscated payload, because the confirmation sheet has nothing to show.
Publish a plain `https://` subscription URL, or a `glitchvpn://add/` link.

## QR codes

Anything above works as a QR code, scanned from the add sheet.

A QR code carrying a subscription URL is a credential in a picture that does not expire, and
screenshots travel further than links do. Use a per-user URL you can revoke.
