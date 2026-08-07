# Identifying devices

The client sends one identifier with every subscription request:

```http
x-hwid: 8f14e45f-ea2c-4f9c-b1ab-6c5f4d2e7a13
```

`x-hwid` is the header the ecosystem already uses, so panels that count devices read it without any
change.

## What the value is

A random UUID, generated once when the app is installed. It is **not derived from the hardware** — no
Android ID, no machine GUID, no vendor identifier, nothing hashed from the device.

- **Reinstalling produces a new identifier.** Clearing the app's data does too.
- **Two installs on one machine are two devices.** A desktop and a phone are two, and so are two
  copies on the same desktop.
- **Nothing links an identifier to a person or a machine.** No other client computes the same value,
  so it cannot be correlated with the same user elsewhere.

## What the user controls

Sending the identifier is on by default. The user can switch it off in settings, and then no
identifier is sent at all.

A subscription cannot switch it back on. `subscription-always-hwid-enable` and
`subscription-alternative-hwid-enabled` are read and ignored. No combination of headers overrides the
user's choice.

Nothing else about the device is sent: no model, no OS version, no OS build, no locale.

## Device limits

A limit of the form "this subscription may be used by at most N devices" works.

**Reinstalls consume slots.** A strict limit of 1 locks a user out of their own subscription after a
phone reset. Allow headroom, expire the oldest identifier rather than the newest, or give the user a
way to release a slot.

**A user who opts out sends nothing.** Counting an absent identifier as one anonymous device is the
usual answer. Refusing to serve a subscription without an identifier turns a privacy setting into a
broken subscription, and the user reports it as a bug in the client.

Enforcement that requires a stable hardware identity cannot be built on this client. Per-user
subscription URLs and server-side concurrent-session limits do not depend on the client identifying
itself, and the settings screen cannot switch them off.
