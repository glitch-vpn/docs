# Geo databases

Rules that name a country or a category — `geoip:ru`, `geosite:category-ads-all` — resolve against
`geoip.dat` and `geosite.dat` files in the v2ray format. The client bundles none, so a
[routing profile](routing.md) using such rules names the files that define them:

```json
{
  "geoip": "https://example.com/geo/geoip.dat",
  "geosite": "https://example.com/geo/geosite.dat"
}
```

Files are shared between subscriptions by URL and content: two providers naming the same file cost one
download.

## A tag only means something inside the file you name

These files have no standard vocabulary. Each builder names its lists as it chooses, so a name in one
build can be absent from another, or present over a different set of entries.

| You write | `v2fly` | `Loyalsoldier/v2ray-rules-dat` | `DigneZzZ/routing` |
|---|---|---|---|
| `geoip:ru` | works | works | **absent** — that list is named `whitelist` |
| `geosite:category-ru` | works | works | works |
| `geosite:category-ads-all` | works | works | **absent** — that list is named `category-ads` |
| `geosite:category-tr` | absent | absent | absent |

Failures take two shapes: a list renamed entirely, and a name one word off.

On import the client checks each tag against the file you named and marks any rule whose tag is missing.
At connect time an unknown tag matches nothing, and that traffic takes the default path.

**Check your tags against the exact file you name**, not against what a tag is called elsewhere. If you
serve your own build, publish its tag names — nobody writing rules against your subscription can learn
them otherwise.

## Publish a validator so clients skip unchanged downloads

Publish a `<file>.sha256` next to each `.dat`, containing only the 64-character hex digest:

```
38c25fea171323e0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4
```

An `ETag` or `Last-Modified` on the file itself works just as well. Clients re-check on their own
interval. With a validator they skip the transfer when nothing changed; without one they download the
file again to find out.

Rebuild on whatever schedule you like. GitHub releases need nothing added — the `/latest/` redirect and
GitHub's `ETag` are enough.

## The client slices your file, the user still pays for the download

The client never keeps or loads a `.dat` whole. On download it keeps **only the lists your rules actually
name** and discards the rest, which never reaches the engine. A rule set naming a country and a category
or two keeps well under a tenth of a general-purpose build in our measurements. For the geoip half of a
pair it is closer to one fiftieth.

Slicing does not save the download. The whole file crosses the wire before anything is cut, every time it
rotates — on a phone, on the user's data plan, possibly while somebody is waiting to connect. So keep the
file small:

- **Publish only the lists your rules use.** A purpose-built pair of a few hundred kilobytes beats a
  general-purpose one.
- **Check what your ad-block list weighs.** The same nominal list can differ between builds by two orders
  of magnitude in entry count. If your profile blocks ads, that one entry can be most of what your users
  download.

## Check your own file

Give a `.dat`, by URL or from disk, and paste your rules — the routing profile itself or one entry per
line. You get the list names the file contains, which of your tags are missing, and how much would be
loaded into the engine.

Nothing is uploaded. The bytes are read in this page, and there is no server here to send them to. Your
browser fetches a URL directly from that host with caching off, so only that host sees the request and no
20 MB file is left on your disk.

A URL works when the host allows a cross-origin read. GitHub raw and release URLs do; an arbitrary CDN
often does not. If it fails, download the file and pick it instead — the measurement is identical.

<div data-geo-slice markdown="0">
  <p><label for="geo-site-url"><strong>geosite.dat</strong></label><br>
    <input type="url" id="geo-site-url" data-geo-url="geosite" style="width:100%"
           placeholder="https://example.com/geo/geosite.dat"><br>
    <small>or from disk:</small> <input type="file" data-geo-file="geosite"></p>

  <p><label for="geo-ip-url"><strong>geoip.dat</strong></label><br>
    <input type="url" id="geo-ip-url" data-geo-url="geoip" style="width:100%"
           placeholder="https://example.com/geo/geoip.dat"><br>
    <small>or from disk:</small> <input type="file" data-geo-file="geoip"></p>

  <p><label for="geo-rules"><strong>Rules</strong></label><br>
    <textarea id="geo-rules" data-geo-rules rows="6" style="width:100%" placeholder="geosite:category-ru
geosite:category-ads-all
geoip:ru

— or paste the whole profile JSON"></textarea></p>

  <p><button type="button" class="md-button md-button--primary" data-geo-run>Measure</button></p>

  <div class="admonition info">
    <p class="admonition-title">Measurement</p>
    <div data-geo-out><p>Nothing measured yet.</p></div>
  </div>
</div>

## Files of 40 MB or more are refused

The client refuses a `.dat` at or above **40 MB** and does not load it. It marks the rules that would have resolved
against it as failing and shows the user which file was refused and why. The ceiling is roughly twice the
size of the largest general-purpose builds we tested.

- **The limit is per file.** A pair can cost up to twice it, another reason to keep the geosite half
  honest.
- **`Content-Length` is checked before the body is read.** A response that omits it is read until the
  ceiling is passed, then abandoned. A chunked response is not a way around the limit; it only wastes the
  transfer that did happen.

### If your list is that big, apply it on your servers

A rule set needing tens of megabytes of lists belongs on your servers, not on every client. Traffic that
reaches you is already yours to route, drop or redirect:

- **One copy, not one per device.** The list lives where you deploy it, not on every phone that ever
  connected.
- **Current immediately.** A change takes effect on the next connection. A list shipped to clients is
  only as fresh as the last refresh on the slowest device, and some are weeks behind.
- **No download at all.** Nothing to fetch, nothing to re-fetch when you rebuild, nothing to hold on a
  phone with 2 GB free.

What belongs on the client is the **split**: which traffic enters the tunnel and which stays outside,
because only the client sees the traffic that never reaches you. That decision needs a country and a
handful of categories, not an enumeration of the internet.
