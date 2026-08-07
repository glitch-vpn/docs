# Responses and errors

Every failure keeps the previously loaded servers in place and usable. A transient failure is retried on
the subscription's own schedule; a final one stops automatic retries.

## Success

| Response | Client | User sees |
|---|---|---|
| `200` with a parseable body | Replaces the server list. Servers that disappeared are removed, new ones added, existing ones keep their ping history and favourites | The list, and the header's "updated" time |
| `200` with entries the client cannot parse | Keeps every valid server, skips the rest | The valid servers, plus a note naming how many entries were skipped and why |
| `304 Not Modified` | Keeps the current list | The "updated" time refreshes |

When nothing changed and the client sent `If-None-Match` or `If-Modified-Since`, send `304`.

## Serving no servers

A successful response carrying no server links means this subscription currently has none.

| Response | Client | User sees |
|---|---|---|
| `200` with an empty body | Clears the server list. The subscription stays | The subscription with no servers, and when it last updated |
| `200` with only metadata lines and no links | The same | The same |
| `204 No Content` | The same | The same |

Use this to suspend access without ending the subscription — a lapsed payment, an account you expect to
reinstate. The next response with links restores the list; the stored URL, name and history are untouched.

**A body whose links are all unsupported is different.** The client keeps the previous list and tells the
user how many entries were skipped and why.

A deploy that briefly serves an empty file does clear lists. While you are broken, answer `5xx`, not
`200` with nothing in it.

## `402 Payment Required`

A notice, not a failure. The subscription's header gains a line telling the user payment is required and
to contact you. It clears on the next response that is not a `402`.

**Nothing is taken away.** The server list is kept, the servers stay connectable, and refreshing
continues on the normal schedule, so payment is picked up automatically. Your servers decide whether
unpaid access keeps working.

The user contacts you through the website and support buttons on that header, so set
`profile-web-page-url` and `support-url`. Without them the notice names you and goes nowhere.

The body is read as for any other successful response:

| You send | Result |
|---|---|
| `402` with the usual list | Servers updated as normal, plus the notice |
| `402` with an empty body | Servers cleared, plus the notice |
| `200` after payment | Notice gone, list restored |

`402` states a billing state now; `expire` in `subscription-userinfo` is a date the client displays. Use
both: the date says when access lapses, the `402` says it has.

## The fallback is always tried

`fallback-url`, when you provide one, is tried on **every** failed fetch: refused connections and
timeouts, `5xx`, and `401` / `403` / `404` / `410`. A status code is a statement by the host that
answered, not a fact about the subscription. A blocking middlebox answers `403` for a domain it dislikes,
and a hijacked host can answer anything. The fallback costs one request, and without it a blocked primary
host loses you every user's subscription.

It is not tried for `200`, `304` or `402` — those are answers. The sections below apply once the fallback
has answered the same way.

## Rejected subscriptions

The subscription's header gains a line: **the subscription could not be updated, contact _your name_** —
the name from `profile-title`. The website and support buttons on that header are how the user acts on it.

| Response | Retries | Reasoning |
|---|---|---|
| `401 Unauthorized` | For three days, then stop | The token is not accepted. Recoverable if it was a deployment mistake |
| `403 Forbidden` | For three days, then stop | Same. A censoring middlebox produces this code most often, so it deserves the window |
| `404 Not Found` | For three days, then stop | The path is missing here. A migration or a broken deploy looks like this |
| `410 Gone` | Stops immediately | You have said the subscription is over. Retrying that answer is noise |

Manual refresh keeps working after retries stop, so a fix on your side is picked up.

Use `403` for an account you intend to reinstate and `410` for one that is finished.

### Only the user removes a subscription

No response code deletes a subscription: it holds the user's URL, server list and history. `410` marks it
ended and stops refreshing it. Removing the entry is an action in the subscription's own menu.

To move a subscription, send `new-url` or `new-domain`: the user confirms, everything else is kept. A
`410` sent to force a migration loses every user who never taps Remove and adds the new link.

A refresh never tears down a live connection. A session on one of this subscription's servers continues,
and the server it uses survives until the session ends.

## Transient failures

Retried indefinitely on the subscription's own schedule. The user is told the subscription could not be
refreshed right now, and is not asked to do anything.

| Response | Notes |
|---|---|
| `408 Request Timeout` | |
| `429 Too Many Requests` | `Retry-After` is honoured when present, up to a day |
| `5xx` | Any server error |
| Anything else unrecognised | A proxy inventing a code should not end a subscription |
| Connection refused, DNS failure, TLS failure, timeout | Not a status code, handled the same way |

## Redirects

`301`, `302`, `307` and `308` are followed, up to five hops, including to another host. The final URL
applies to that fetch only; it does not replace the stored subscription URL.

## What the client never shows

**Your response body is never displayed**, on an error or on success. Answer `403` with
`{"error": "Renew at example.com/pay"}` and the user still sees the client's own wording for a rejected
subscription. The same goes for response headers, HTML error pages and reason phrases.

Three things of yours do appear: the name from `profile-title`, which the message names, and the website
and support buttons from `profile-web-page-url` and `support-url`. You set all three once, so an error
path cannot become a place to display "your subscription expired, pay here".

## Timeouts and rate limits

A request that has produced nothing for ten seconds is abandoned and counts as transient.

The client fetches a subscription on its interval, when the user asks it to, and once at app start if the
interval has elapsed. It does not poll. `profile-update-interval` makes it less frequent. Nothing makes
it more frequent than the user's own refresh button.
