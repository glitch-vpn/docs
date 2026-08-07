# Glitch VPN

Glitch VPN is an open-source VPN client for Android and Windows, with no accounts and no backend of
its own. You bring the servers: a subscription link your provider gave you, or a config you paste in.

The app connects only to your servers, the subscription URLs you added, and the geo-database URLs you
chose. It sends no telemetry, no analytics and no crash reports, not behind a flag and not opt-in.

## For providers

- **[Subscription format](providers/subscription.md)** — protocols, body formats, metadata headers
- **[Responses and errors](providers/responses.md)** — status codes, and what each one tells the user
- **[Routing profiles](providers/routing.md)** — rules you can ship with a subscription
- **[Geo databases](providers/geo.md)** — serving `.dat` files, and the tag trap to avoid
- **[Deep links](providers/deep-links.md)** — `glitchvpn://`
- **[Identifying devices](providers/devices.md)** — what `x-hwid` is, and what it is not

## Source

[glitch-vpn/glitch](https://github.com/glitch-vpn/glitch) on GitHub.
