// Adds a "Copy as Markdown" button that copies the page's own source.
//
// The source is published beside the HTML by hooks/copy_source.py, so the button
// fetches that rather than trying to turn rendered HTML back into Markdown.
//
// The button goes into Material's own content-button slot, next to the edit
// pencil, so it inherits the theme's styling and needs no template override.

(() => {
  // material/content-copy from the theme's own icon set, inlined rather than
  // fetched: an icon that arrives late leaves a button nobody can see, and one
  // that fails to arrive leaves a button nobody knows is there. Same file the
  // theme ships and redistributes, Apache-2.0, Material Design Icons.
  const ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
    '<path d="M19 21H8V7h11m0-2H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2' +
    'm-3-4H4a2 2 0 0 0-2 2v14h2V3h12z"/></svg>';

  const CHECK =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
    '<path d="M21 7 9 19l-5.5-5.5 1.4-1.4L9 16.2 19.6 5.6z"/></svg>';

  const LABEL = 'Copy this page as Markdown';

  // The theme's own snackbar — the one it shows when a code block is copied — so
  // the confirmation looks and behaves like the rest of the site.
  const announce = (message) => {
    const dialog = document.querySelector('[data-md-component=dialog]');
    if (!dialog) return;
    const inner = dialog.querySelector('.md-dialog__inner') || dialog;
    inner.textContent = message;
    dialog.classList.add('md-dialog--active');
    clearTimeout(announce.timer);
    announce.timer = setTimeout(() => dialog.classList.remove('md-dialog--active'), 2000);
  };

  const sourceUrl = () => {
    const url = new URL(window.location.href);
    url.hash = '';
    url.search = '';
    // Directory URLs end in a slash; a page served as /foo.html would not.
    return url.pathname.endsWith('/')
      ? `${url.pathname}index.md`
      : url.pathname.replace(/\.html?$/, '.md');
  };

  const copy = async (text) => {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
    // http://localhost is a secure context, but a page served over plain http
    // from anywhere else is not, and there the Clipboard API is unavailable.
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  };

  document.addEventListener('DOMContentLoaded', () => {
    const inner = document.querySelector('.md-content__inner');
    if (!inner || !inner.querySelector('h1')) return;

    const button = document.createElement('button');
    button.type = 'button';
    // Same classes as the theme's own edit and view buttons for placement and
    // size; colour and the hover and pressed states come from glitch.css, because
    // the theme styles those buttons as links and this one is a <button>.
    button.className = 'md-content__button md-icon';
    button.title = LABEL;

    button.innerHTML = ICON;

    let busy = false;
    button.addEventListener('click', async () => {
      if (busy) return;
      busy = true;
      try {
        const response = await fetch(sourceUrl());
        if (!response.ok) throw new Error(String(response.status));
        await copy(await response.text());
        button.innerHTML = CHECK;
        button.title = 'Copied';
        announce('Copied to clipboard');
      } catch {
        button.title = 'Could not copy this page';
        announce('Could not copy this page');
      }
      setTimeout(() => {
        button.innerHTML = ICON;
        button.title = LABEL;
        busy = false;
      }, 2000);
    });

    // Before the edit pencil when there is one, so the order stays stable.
    const edit = inner.querySelector('a.md-content__button');
    if (edit) edit.before(button);
    else inner.insertBefore(button, inner.firstChild);
  });
})();
