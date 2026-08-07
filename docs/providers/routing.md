# Routing profiles

A routing profile is an optional set of rules you ship with a subscription. It appears in the user's
settings as a named group they can read and switch off, but not edit. Only the rules of the provider
whose server is connected are in effect — profiles never combine across providers.

## How a profile reaches the client

| Delivery | Form |
|---|---|
| `routing` response header | base64 of the JSON, or a link |
| A line in the subscription body | the link form |
| A deep link the user opens | see [Deep links](deep-links.md) |

```http
routing: ewogICJuYW1lIjogImV4YW1wbGUtcnVsZXMiLAogICJkaXJlY3QiOiBbImdlb3NpdGU6Y2F0ZWdvcnktcnUiLCAiZ2VvaXA6cnUiXQp9
```

A profile whose `Name` matches one already attached to that subscription replaces it.

## Format

```json
{
  "name": "example-rules",
  "geoip": "https://example.com/geo/geoip.dat",
  "geosite": "https://example.com/geo/geosite.dat",
  "domainStrategy": "ipifnonmatch",
  "dns": {
    "servers": ["https://cloudflare-dns.com/dns-query"],
    "directServers": ["77.88.8.8"],
    "hosts": { "cloudflare-dns.com": ["1.1.1.1"] }
  },
  "reject": ["geosite:category-ads-all"],
  "direct": ["geosite:category-ru", "geoip:ru", "app:com.my.bank"],
  "proxy": ["example.com", "process:Discord.exe"]
}
```

| Field | |
|---|---|
| `name` | Required. The group name the user sees, and the key by which a later profile replaces this one |
| `reject`, `direct`, `proxy` | The rules, one list per outcome. At least one list has to be non-empty |
| `geoip`, `geosite` | URLs of the files that `geoip:` and `geosite:` entries resolve against |
| `domainStrategy` | `asis` (default), `ipifnonmatch`, or `ipondemand` |
| `dns.servers` | Resolvers for proxied names |
| `dns.directServers` | Resolvers for names routed direct |
| `dns.hosts` | Static name to addresses |

Everything except `name` and the rules is optional. Unknown fields are ignored.

## Rule entries

Each entry is typed by its prefix:

| Prefix | Matches | Platforms |
|---|---|---|
| `domain:` | a host and all its subdomains | all |
| `full:` | one host exactly | all |
| `keyword:` | a substring of the host | all |
| `regexp:` | a regular expression over the host | all |
| `geosite:` | a category in your `geosite` file | all |
| `geoip:` | a country or category in your `geoip` file | all |
| `app:` | an Android package name, `com.example.app` | Android |
| `process:` | an executable name, `Discord.exe` | desktop |
| no prefix | an IP or CIDR if it parses as one, otherwise a domain suffix | all |

`app:` and `process:` are not synonyms:

- **`app:` is Android.** The rule goes to the operating system's own split tunneling, not to the
  routing engine.
- **`process:` is desktop.** The executable name is matched by the client's own dialer. Android has
  no equivalent.

To cover an application on both, send both: `app:com.example.app` and `process:Example.exe`. Each is
ignored on the platform it does not apply to. A rule for a platform the user is not on is shown as
unsupported rather than dropped silently.

`domain:` and `full:` match on label boundaries and ignore surrounding dots, so `domain:.ru` and
`domain:ru` are one rule covering every `*.ru`. `keyword:` is a plain substring and keeps its dots.

`geosite:` accepts the attribute form, `geosite:cn@ads`, and a category whose own name contains `!`,
such as `geosite:geolocation-!cn`. `geoip:` accepts the inverse form, `geoip:!ru`.

## Outcomes and precedence

**Reject beats direct beats proxy** — by outcome, not by list position or by how narrow a rule is. If
`geoip:ru` is direct and one address inside it is in your proxy list, direct wins.

Unmatched traffic follows the user's Catch All setting, which you cannot set. The default is to
tunnel everything, so a profile assuming unlisted traffic goes direct will see all of the user's
traffic.

The user's own rules, when enabled, are evaluated before yours and win an overlap. `process:` rules
are the exception: across both groups they resolve by outcome, not by group order.

## Android apps cannot be rejected

Android's split tunneling can only include an application in the tunnel or exclude it.
**Rejecting an `app:` rule is not possible**; a rule that tries is refused, not treated as direct.
Desktop `process:` rules are matched inside the client, where reject works.

Changing which applications are in the tunnel takes effect on the next connection.

The `per-app-proxy-list` header is read as a list of `app:` rules and joins your rule group. It does
not overwrite the user's own split-tunnel choices.

## DNS

`dns.servers` and `dns.directServers` accept a plain IP, `https://` for DoH, `quic://` and `tcp://`.
A plain entry may carry a port (`10.0.0.1:5353`). `tls://` (DoT) is unsupported and such an entry is
dropped.

`dns.hosts` exists for bootstrapping: a DoH resolver given only as a URL cannot be reached when its
own hostname is unresolvable.

AmneziaWG ignores DNS configuration beyond a single plain resolver.

## `domainStrategy`

`asis` (the default), `ipifnonmatch`, or `ipondemand` — whether the router resolves a request that
arrived as a domain so that IP rules can match it.

If your rule set does not need it, leave `domainStrategy` at `asis`. The lookups happen before the
client knows whether a name is proxied, so they leave through the direct path in the clear.

## Geo files

A tag that your `geoip` or `geosite` file does not contain matches nothing — the most common way a
profile silently does less than intended. [Geo databases](geo.md) covers it in full.

## Other formats accepted

A profile you already generate in this shape needs no rewriting:

```json
{
  "Name": "example-rules",
  "Geoipurl": "https://example.com/geo/geoip.dat",
  "Geositeurl": "https://example.com/geo/geosite.dat",
  "DomainStrategy": "IPIfNonMatch",
  "RemoteDNSDomain": "https://cloudflare-dns.com/dns-query",
  "RemoteDNSIP": "1.1.1.1",
  "DomesticDNSIP": "77.88.8.8",
  "DnsHosts": { "cloudflare-dns.com": "1.1.1.1" },
  "BlockSites": ["geosite:category-ads-all"],
  "BlockIp": [],
  "DirectSites": ["geosite:category-ru"],
  "DirectIp": ["geoip:ru"],
  "ProxySites": ["example.com"],
  "ProxyIp": [],
  "GlobalProxy": "true",
  "FakeDNS": "false",
  "LastUpdated": "1790951622"
}
```

| Field | Read as |
|---|---|
| `Name` | `name` |
| `BlockSites`, `BlockIp` | `reject` |
| `DirectSites`, `DirectIp` | `direct` |
| `ProxySites`, `ProxyIp` | `proxy` |
| `Geoipurl`, `Geositeurl` | `geoip`, `geosite` |
| `DomainStrategy` | `domainStrategy`, case-insensitively |
| `RemoteDNSDomain`, `RemoteDNSIP`, `RemoteDns` | `dns.servers` |
| `DomesticDNSDomain`, `DomesticDNSIP`, `DomesticDns` | `dns.directServers` |
| `DnsHosts` | `dns.hosts`, a single address becoming a one-element list |

These fields are read and ignored:

| Field | Why |
|---|---|
| `GlobalProxy` | Catch All is the user's setting, so a profile written for `GlobalProxy: false` behaves differently here |
| `RemoteDNSType`, `DomesticDNSType` | The scheme in the URL already says whether a resolver is DoH |
| `FakeDNS` | fake-ip is always on. It keeps domain rules matching traffic that never asked the client to resolve anything |
| `LastUpdated` | A newer fetch replaces the profile it carries, so freshness needs no timestamp |

## What a profile cannot do

- Change the user's Catch All, IPv6 or UDP settings.
- Turn the device identifier on.
- Hide anything from the user, including its own rules — they are always visible and can always be
  switched off.
- Reach the user's other subscriptions.
