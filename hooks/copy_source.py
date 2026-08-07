"""Publishes each page's Markdown source, and an llms.txt index of them.

A rendered page cannot be turned back into faithful Markdown, so the source is
shipped alongside the HTML in two shapes:

  /providers/geo/index.md   next to the page's index.html, which the Copy button
                            fetches
  /providers/geo.md         the "append .md to the URL" convention readers and
                            crawlers expect

and /llms.txt indexes them, per llmstxt.org.

Plain mkdocs hooks rather than a plugin: no dependency to pin.
"""

import re
from pathlib import Path

_pages = []


def on_page_markdown(markdown, page, config, files):
    # Stashed because on_post_page only receives the rendered HTML.
    page.source_markdown = markdown
    return markdown


def on_post_page(output, page, config):
    source = getattr(page, "source_markdown", None)
    if source is None:
        return output

    site = Path(config["site_dir"])
    dest = Path(page.file.dest_path)

    beside = site / dest.with_suffix(".md")
    beside.parent.mkdir(parents=True, exist_ok=True)
    beside.write_text(source, encoding="utf-8")

    # /providers/geo/index.html -> /providers/geo.md, so appending .md to a page
    # URL works. The root page has no sibling form; index.md above covers it.
    if dest.name == "index.html" and dest.parent != Path("."):
        sibling = site / dest.parent.with_suffix(".md")
        sibling.parent.mkdir(parents=True, exist_ok=True)
        sibling.write_text(source, encoding="utf-8")

    _pages.append((page.title, page.url, _summary(source)))
    return output


def _summary(source, limit=200):
    """First paragraph as one plain-text line, short enough to scan."""
    lines = []
    for line in source.splitlines():
        stripped = line.strip()
        if stripped.startswith("#"):
            continue
        if not stripped:
            if lines:
                break
            continue
        lines.append(stripped)

    text = " ".join(lines)
    # Inline links would be relative to the page, and llms.txt sits at the root.
    text = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", text)
    text = text.replace("**", "").replace("`", "")
    # A paragraph introducing a code block ends in a colon that reads as truncation.
    text = text.rstrip(":").strip()

    if len(text) <= limit:
        return text
    cut = text[:limit]
    stop = max(cut.rfind(". "), cut.rfind("? "))
    return cut[: stop + 1] if stop > limit // 2 else cut.rsplit(" ", 1)[0] + "…"


def on_post_build(config):
    site = Path(config["site_dir"])

    base = (config.get("site_url") or "/").rstrip("/")
    lines = [f"# {config['site_name']}", ""]
    if config.get("site_description"):
        lines += [f"> {config['site_description']}", ""]
    lines += ["Every page is also available as Markdown: append `.md` to its URL.", "", "## Pages", ""]
    for title, url, summary in _pages:
        markdown_url = f"{base}/{url}".rstrip("/") + ".md" if url else f"{base}/index.md"
        lines.append(f"- [{title}]({markdown_url}){': ' + summary if summary else ''}")

    (site / "llms.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
    _pages.clear()
