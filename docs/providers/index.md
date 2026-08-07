# For providers

There is no backend, no account system and no device registry. This client reads a file you serve,
in the format the ecosystem already uses. A standard subscription endpoint works as it is.

## What this client does not do

**Identify the device.** There is no hardware fingerprint. The client can send a random identifier
generated at install time in the `x-hwid` header, but sending it is the user's choice, off by
default, and your subscription cannot switch it on. The identifier resets on reinstall, and two
installs on one machine are two identifiers. Device limits that assume one id equals one machine
forever will not behave the way they do elsewhere.

**Enforce your limits.** Traffic totals and expiry dates are displayed, and the bar turns red when a
limit is reached. Nothing is cut off. If a subscription must stop working, your server stops serving
it.

**Render your text.** There is no announcement banner, no push and no provider-styled notice. Your
website and support links are shown as buttons, and that is the channel.

## What the user controls

- Which way unmatched traffic goes, through the tunnel or direct.
- Whether IPv6 and UDP are blocked.
- Whether your suggested routing rules apply, and whether the user's own rules override them.

Parameters that try to set these are read and ignored.

## A working subscription

Return a list of links, one per line, plain or base64, and set two headers:

```http
HTTP/1.1 200 OK
profile-title: My VPN
subscription-userinfo: upload=0; download=2153701362; total=107374182400; expire=1790951622

vless://uuid@server1.example.com:443?security=reality&sni=example.com#🇩🇪 Germany
vless://uuid@server2.example.com:443?security=reality&sni=example.com#🇳🇱 Netherlands
```

That is a complete subscription. Optional on top of it:

- [Responses and errors](responses.md) — which status codes end a subscription, and what the user is told
- [Routing profiles](routing.md) — rules you ship with a subscription
- [Geo databases](geo.md) — serving `.dat` files
- [Deep links](deep-links.md) — `glitchvpn://`
- [Identifying devices](devices.md) — what `x-hwid` is
