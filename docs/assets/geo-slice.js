// Reports how much of a geosite/geoip pair a rule set would actually keep.
//
// Both files are a repeated field 1 of records, each holding its name in field 1
// and its entries in a repeated field 2 — so one walk serves both. Only record
// framing is read, so a 20 MB file is a few milliseconds of work.
//
// Bytes stay in this page: there is no server here to send them to. A URL is
// fetched by the browser straight from that host.

(() => {
  const SIZE_LIMIT = 40 * 1024 * 1024;
  const KINDS = ['geosite', 'geoip'];

  const readVarint = (bytes, i) => {
    let value = 0;
    let shift = 1;
    while (i < bytes.length) {
      const b = bytes[i++];
      value += (b & 0x7f) * shift;
      if (b < 0x80) return [value, i];
      shift *= 128;
    }
    return [0, -1];
  };

  const skip = (bytes, i, wire) => {
    if (wire === 0) return readVarint(bytes, i)[1];
    if (wire === 1) return i + 8;
    if (wire === 5) return i + 4;
    if (wire === 2) {
      const [len, next] = readVarint(bytes, i);
      return next < 0 ? -1 : next + len;
    }
    return -1;
  };

  const readRecord = (bytes, start, end) => {
    let i = start;
    let name = '';
    let entries = 0;
    while (i < end) {
      const [key, next] = readVarint(bytes, i);
      if (next < 0) break;
      i = next;
      const field = Math.floor(key / 8);
      const wire = key % 8;
      if (field === 1 && wire === 2) {
        const [len, afterLen] = readVarint(bytes, i);
        name = new TextDecoder().decode(bytes.subarray(afterLen, afterLen + len));
        i = afterLen + len;
      } else if (field === 2 && wire === 2) {
        entries++;
        const [len, afterLen] = readVarint(bytes, i);
        i = afterLen + len;
      } else {
        i = skip(bytes, i, wire);
        if (i < 0) break;
      }
    }
    return { name, entries };
  };

  const parse = (bytes) => {
    const records = [];
    let i = 0;
    while (i < bytes.length) {
      const [key, afterKey] = readVarint(bytes, i);
      if (afterKey < 0) break;
      const field = Math.floor(key / 8);
      const wire = key % 8;
      if (wire !== 2) break;
      const [len, afterLen] = readVarint(bytes, afterKey);
      if (afterLen < 0 || afterLen + len > bytes.length) break;
      if (field === 1) {
        const record = readRecord(bytes, afterLen, afterLen + len);
        record.bytes = afterLen - i + len; // framing included
        records.push(record);
      }
      i = afterLen + len;
    }
    return records;
  };

  // Accepts a routing profile or one entry per line, and keeps geosite and geoip
  // tags apart: each only ever resolves against its own file.
  const wantedTags = (text) => {
    const lines = [];
    const trimmed = text.trim();
    if (trimmed.startsWith('{')) {
      try {
        const profile = JSON.parse(trimmed);
        const arrays = [
          'reject', 'direct', 'proxy',
          'BlockSites', 'BlockIp', 'DirectSites', 'DirectIp', 'ProxySites', 'ProxyIp',
        ];
        for (const key of arrays) {
          if (Array.isArray(profile[key])) lines.push(...profile[key]);
        }
      } catch {
        return null;
      }
    } else {
      lines.push(...trimmed.split('\n'));
    }

    const tags = { geosite: new Set(), geoip: new Set() };
    let other = 0;
    for (const raw of lines) {
      const entry = String(raw).trim().replace(/,$/, '').replace(/^["']|["']$/g, '');
      if (!entry) continue;
      const match = /^(geosite|geoip):(.+)$/i.exec(entry);
      if (!match) {
        other++;
        continue;
      }
      const name = match[2].trim().toLowerCase().split('@')[0].replace(/^!/, '');
      if (name) tags[match[1].toLowerCase()].add(name);
    }
    return { tags, other };
  };

  const size = (n) => {
    if (n >= 1048576) return `${(n / 1048576).toFixed(2)} MB`;
    if (n >= 1024) return `${Math.round(n / 1024)} KB`;
    return `${n} B`;
  };
  const num = (n) => n.toLocaleString('en-US');
  const plural = (n, one, many) => `${num(n)} ${n === 1 ? one : many}`;
  const pct = (part, whole) => {
    if (!whole) return '0';
    const value = (100 * part) / whole;
    return value > 0 && value < 0.01 ? '<0.01' : value.toFixed(2);
  };

  // List names come out of somebody else's file and tags out of a textarea;
  // neither goes into the page unescaped.
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[c]);

  // A URL only works when the host allows a cross-origin read; a picked file
  // always does. Returns null when neither was given for this kind.
  //
  // `no-store` on purpose: without it a 20 MB download lands in the browser's
  // cache on the reader's disk, and a page has no way to remove it afterwards.
  // Nothing is kept, so there is nothing to clean up.
  const load = async (root, kind, onProgress) => {
    const url = root.querySelector(`[data-geo-url="${kind}"]`).value.trim();

    if (!url) {
      const file = root.querySelector(`[data-geo-file="${kind}"]`).files[0];
      if (!file) return null;
      onProgress(kind, { phase: 'reading', name: file.name });
      const buffer = await file.arrayBuffer();
      return { bytes: new Uint8Array(buffer), name: file.name, size: file.size };
    }

    const name = url.split('/').pop() || url;
    onProgress(kind, { phase: 'connecting', name });

    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`${kind}: HTTP ${response.status}`);

    const declared = Number(response.headers.get('content-length')) || 0;
    // The client refuses these before spending the transfer, so this does too.
    if (declared >= SIZE_LIMIT) {
      return { bytes: new Uint8Array(0), name, size: declared, refused: true };
    }

    if (!response.body) {
      const buffer = await response.arrayBuffer();
      return { bytes: new Uint8Array(buffer), name, size: buffer.byteLength };
    }

    const reader = response.body.getReader();
    const chunks = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (received >= SIZE_LIMIT) {
        // No Content-Length to check up front, so the ceiling is found the hard
        // way — which is what the client does with such a response too.
        await reader.cancel();
        return { bytes: new Uint8Array(0), name, size: received, refused: true };
      }
      onProgress(kind, { phase: 'downloading', name, received, total: declared });
    }

    const bytes = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    onProgress(kind, { phase: 'measuring', name });
    return { bytes, name, size: received };
  };

  const measure = (source, wanted) => {
    const started = performance.now();
    const records = parse(source.bytes);
    const took = Math.max(1, Math.round(performance.now() - started));

    const byName = new Map(records.map((r) => [r.name.toLowerCase(), r]));
    const found = [];
    const missing = [];
    for (const tag of wanted) {
      const record = byName.get(tag);
      if (record) found.push(record);
      else missing.push(tag);
    }

    return {
      source,
      records,
      found,
      missing,
      took,
      valid: records.length > 0,
      kept: found.reduce((sum, r) => sum + r.bytes, 0),
      keptEntries: found.reduce((sum, r) => sum + r.entries, 0),
      totalEntries: records.reduce((sum, r) => sum + r.entries, 0),
    };
  };

  const renderFile = (kind, result) => {
    const html = [];
    // A paragraph rather than a heading: this lands inside a card, where a
    // heading outweighs everything around it.
    html.push(`<p><strong><code>${kind}</code> — ${esc(result.source.name)}</strong></p>`);

    if (result.source.refused) {
      html.push(
        `<p><strong>Refused at ${size(result.source.size)}.</strong> This file is at or above the ` +
          '40 MB limit, so the client would not download it and none of its rules would resolve. ' +
          'The transfer was abandoned here too.</p>'
      );
      return html.join('');
    }

    if (!result.valid) {
      html.push(
        '<p>No lists found. This does not look like a file in the v2ray <code>.dat</code> format.</p>'
      );
      return html.join('');
    }

    if (result.source.size >= SIZE_LIMIT) {
      html.push(
        `<p><strong>Refused.</strong> At ${size(result.source.size)} this file is at or above the ` +
          '40 MB limit, so it would not be downloaded and none of its rules would resolve.</p>'
      );
    }

    html.push(
      `<p><strong>${size(result.kept)}</strong> of ${size(result.source.size)} loaded — ` +
        `${pct(result.kept, result.source.size)}%, ` +
        `${num(result.keptEntries)} of ${num(result.totalEntries)} entries. ` +
        `<small>${plural(result.records.length, 'list', 'lists')} in the file, read in ` +
        `${result.took} ms.</small></p>`
    );

    const rows = [];
    for (const r of result.found.sort((a, b) => b.bytes - a.bytes)) {
      rows.push(
        `<tr><td><code>${esc(r.name.toLowerCase())}</code></td><td>kept</td>` +
          `<td>${size(r.bytes)}</td><td>${num(r.entries)}</td></tr>`
      );
    }
    for (const tag of result.missing.sort()) {
      rows.push(
        `<tr><td><code>${esc(tag)}</code></td><td><strong>missing</strong></td>` +
          '<td colspan="2">not in this file, so the rule matches nothing</td></tr>'
      );
    }
    if (rows.length) {
      html.push(
        '<table><thead><tr><th>List</th><th></th><th>Size</th><th>Entries</th></tr></thead>' +
          `<tbody>${rows.join('')}</tbody></table>`
      );
    } else {
      html.push(`<p>No <code>${kind}:</code> rules to resolve against it.</p>`);
    }
    return html.join('');
  };

  const run = (root) => {
    const out = root.querySelector('[data-geo-out]');
    const wanted = wantedTags(root.querySelector('[data-geo-rules]').value);

    if (!wanted) return void (out.innerHTML = '<p>That looks like JSON but does not parse.</p>');
    if (!wanted.tags.geosite.size && !wanted.tags.geoip.size) {
      return void (out.innerHTML =
        '<p>No <code>geosite:</code> or <code>geoip:</code> entries found in those rules.</p>');
    }

    // One progress line per file, so a slow host is visibly a slow host rather
    // than a page that might be stuck.
    const progress = {};
    const showProgress = (kind, state) => {
      progress[kind] = state;
      const lines = KINDS.filter((k) => progress[k]).map((k) => {
        const s = progress[k];
        const what = `<code>${k}</code> · ${esc(s.name)}`;
        if (s.phase === 'downloading') {
          const done = size(s.received);
          return s.total
            ? `${what} — downloading ${done} of ${size(s.total)} ` +
                `(${Math.round((100 * s.received) / s.total)}%)`
            : `${what} — downloading ${done}, size unknown`;
        }
        if (s.phase === 'connecting') return `${what} — connecting…`;
        if (s.phase === 'reading') return `${what} — reading…`;
        return `${what} — measuring…`;
      });
      out.innerHTML = lines.map((l) => `<p>${l}</p>`).join('');
    };

    Promise.all(KINDS.map((kind) => load(root, kind, showProgress)))
      .then((sources) => {
        const results = {};
        KINDS.forEach((kind, i) => {
          if (sources[i]) results[kind] = measure(sources[i], wanted.tags[kind]);
        });

        if (!Object.keys(results).length) {
          out.innerHTML = '<p>Give a URL or pick a file for at least one of the two.</p>';
          return;
        }

        const given = Object.values(results);
        const totalSize = given.reduce((sum, r) => sum + r.source.size, 0);
        const totalKept = given.reduce((sum, r) => sum + r.kept, 0);

        const html = [];
        if (given.length > 1) {
          html.push(
            `<p style="font-size:1.1em"><strong>${size(totalKept)}</strong> loaded from ` +
              `${size(totalSize)} of files — ${pct(totalKept, totalSize)}% of the pair.</p>`
          );
        }

        for (const kind of KINDS) {
          if (results[kind]) html.push(renderFile(kind, results[kind]));
          else if (wanted.tags[kind].size) {
            html.push(
              `<p><strong><code>${kind}</code></strong></p><p>No file given, so ` +
                `${plural(wanted.tags[kind].size, 'tag', 'tags')} could not be checked.</p>`
            );
          }
        }

        const missingCount = given.reduce((sum, r) => sum + r.missing.length, 0);
        if (missingCount) {
          html.push(
            `<p><strong>${plural(missingCount, 'tag', 'tags')}</strong> ` +
              `${missingCount === 1 ? 'is' : 'are'} not in the file that should define ` +
              `${missingCount === 1 ? 'it' : 'them'}. Check the names against these builds rather ` +
              'than against what they are called elsewhere.</p>'
          );
        }
        if (wanted.other) {
          html.push(
            `<p><small>${plural(wanted.other, 'rule', 'rules')} ` +
              `${wanted.other === 1 ? 'needs' : 'need'} no geo file and cost nothing here.</small></p>`
          );
        }
        out.innerHTML = html.join('');
      })
      .catch((error) => {
        out.innerHTML =
          `<p>Could not read that file${error && error.message ? ` — ${esc(error.message)}` : ''}.</p>` +
          '<p>If you used a URL, the host has to allow a cross-origin read for a page to fetch it, ' +
          'and most do not. GitHub raw and release URLs work. Otherwise download the file and pick ' +
          'it instead — the measurement is the same.</p>';
      });
  };

  document.addEventListener('DOMContentLoaded', () => {
    for (const root of document.querySelectorAll('[data-geo-slice]')) {
      root.querySelector('[data-geo-run]').addEventListener('click', () => run(root));
    }
  });
})();
