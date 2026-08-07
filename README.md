# Glitch VPN documentation

Source for <https://glitch-vpn.github.io/docs/> — the integration guide for providers serving the
Glitch VPN client. Pages live in `docs/`, the site is built with mkdocs-material and published to
GitHub Pages by `.github/workflows/pages.yml`.

## Running it locally

```bash
python -m venv .venv
./.venv/Scripts/python.exe -m pip install -r requirements.txt   # POSIX: .venv/bin/python
./.venv/Scripts/python.exe -m mkdocs serve
```

`mkdocs build --strict` is what CI runs. It fails on a broken internal link and on a page missing from
the `nav` in `mkdocs.yml`.

## Contributing

Every page has an edit link in its top right corner. Corrections to anything the client does
differently from what is written here are the most useful kind.
