import type { ReactNode } from 'react';

/** Detects http(s) URLs in plain text (not inside HTML). */
const URL_RE = /https?:\/\/[^\s<>"']+/gi;

/**
 * Strips trailing characters until `URL` accepts the string (http/https only).
 * Returns null if no valid URL prefix exists.
 */
function peelHttpUrl(raw: string): { href: string; afterLink: string } | null {
  let candidate = raw;
  let afterLink = '';
  for (let i = 0; i < 12 && candidate.length > 0; i += 1) {
    try {
      const u = new URL(candidate);
      if (u.protocol === 'http:' || u.protocol === 'https:') {
        return { href: u.href, afterLink };
      }
    } catch {
      /* shrink */
    }
    afterLink = candidate.slice(-1) + afterLink;
    candidate = candidate.slice(0, -1);
  }
  return null;
}

function linkifyLine(line: string, keyPrefix: string): ReactNode {
  const nodes: ReactNode[] = [];
  let last = 0;
  const re = new RegExp(URL_RE.source, 'gi');
  let m: RegExpExecArray | null;
  let n = 0;
  while ((m = re.exec(line)) !== null) {
    const raw = m[0];
    const start = m.index;
    if (start > last) {
      nodes.push(line.slice(last, start));
    }
    const peeled = peelHttpUrl(raw);
    if (peeled) {
      nodes.push(
        <a
          key={`${keyPrefix}-a${n++}`}
          href={peeled.href}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-emerald-700 underline decoration-emerald-600/50 underline-offset-2 hover:text-emerald-900"
        >
          {peeled.href}
        </a>,
      );
      if (peeled.afterLink) {
        nodes.push(peeled.afterLink);
      }
    } else {
      nodes.push(raw);
    }
    last = start + raw.length;
  }
  if (last < line.length) {
    nodes.push(line.slice(last));
  }
  return nodes.length > 0 ? nodes : line;
}

/**
 * Renders plain text with `http://` / `https://` segments as external links.
 * Preserves line breaks via `<br />`.
 */
export function linkifyPlainText(text: string, keyPrefix: string): ReactNode {
  const lines = text.split('\n');
  return lines.map((line, lineIdx) => (
    <span key={`${keyPrefix}-ln${lineIdx}`}>
      {lineIdx > 0 ? <br /> : null}
      {linkifyLine(line, `${keyPrefix}-ln${lineIdx}`)}
    </span>
  ));
}
