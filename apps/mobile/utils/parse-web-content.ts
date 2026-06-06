import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';

// Mirror the repository constant — we truncate before writing to avoid the
// service-layer throw. Keep in sync with core/src/db/repositories/notes.repository.ts
const MAX_NOTE_SIZE = 145_000; // bytes

// Reserve headroom for the source blockquote prefix (~200 bytes)
const CONTENT_BUDGET = MAX_NOTE_SIZE - 512;

export interface ParsedWebContent {
  title: string;
  /** Readability-cleaned HTML, safe to use directly as note content. */
  contentHtml: string;
  excerpt: string;
  siteName: string;
  /** Author name if Readability could detect it, otherwise empty string. */
  byline: string;
}

/**
 * Fetches a URL and extracts the main article body using @mozilla/readability.
 *
 * Returns cleaned HTML (not Markdown) — the editor stores Tiptap ProseMirror
 * HTML so we write it straight in. Content is truncated to stay within
 * MAX_NOTE_SIZE bytes.
 *
 * Throws if the fetch fails or Readability cannot parse the page.
 */
export async function parseWebContent(url: string): Promise<ParsedWebContent> {
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/605.1.15',
      Accept: 'text/html',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${url}`);
  }

  const html = await response.text();

  // linkedom gives us a DOM-like environment without a real browser.
  const { document } = parseHTML(html);

  // Readability needs baseURI for resolving relative links inside the article.
  Object.defineProperty(document, 'baseURI', {
    value: url,
    configurable: true,
    enumerable: true,
    writable: true,
  });
  Object.defineProperty(document, 'documentURI', {
    value: url,
    configurable: true,
    enumerable: true,
    writable: true,
  });

  // Strip all elements containing inline binary/base64 data (data: or blob: URIs)
  // in src, srcset, or data attributes to prevent storing raw binary files in the database.
  // We wrap the NodeListOf elements in Array.from to satisfy the TypeScript compilation environment.
  const elementsWithSrc = Array.from(document.querySelectorAll('[src]'));
  for (const el of elementsWithSrc) {
    const src = el.getAttribute('src');
    if (src && (src.startsWith('data:') || src.startsWith('blob:'))) {
      el.remove();
    }
  }

  const elementsWithSrcset = Array.from(document.querySelectorAll('[srcset]'));
  for (const el of elementsWithSrcset) {
    const srcset = el.getAttribute('srcset');
    if (srcset && (srcset.includes('data:') || srcset.includes('blob:'))) {
      el.remove();
    }
  }

  const elementsWithData = Array.from(document.querySelectorAll('[data]'));
  for (const el of elementsWithData) {
    const dataVal = el.getAttribute('data');
    if (dataVal && (dataVal.startsWith('data:') || dataVal.startsWith('blob:'))) {
      el.remove();
    }
  }

  const article = new Readability(document as any).parse();

  if (!article) {
    throw new Error('Could not extract article content from this page');
  }

  const hostname = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  })();

  return {
    title: article.title ?? '',
    contentHtml: truncateHtml(article.content ?? ''),
    excerpt: article.excerpt ?? '',
    siteName: article.siteName ?? hostname,
    byline: article.byline ?? '',
  };
}

/**
 * Truncates an HTML string so that its UTF-8 byte size stays strictly within
 * CONTENT_BUDGET. We use TextEncoder to measure byte length exactly, and progressively
 * shrink the string by character slice to guarantee it stays under budget. This avoids
 * the use of TextDecoder (which is missing in stable Hermes builds).
 */
function truncateHtml(html: string): string {
  const encoder = new TextEncoder();
  
  if (encoder.encode(html).length <= CONTENT_BUDGET) {
    return html;
  }

  // Find the largest slice of characters that fits within the budget
  let charLength = Math.min(html.length, CONTENT_BUDGET);
  let sliced = html.slice(0, charLength);

  while (charLength > 0 && encoder.encode(sliced).length > CONTENT_BUDGET) {
    const excessBytes = encoder.encode(sliced).length - CONTENT_BUDGET;
    // Shrink character length by at least 1, proportionally to the excess bytes
    const shrinkBy = Math.max(1, Math.floor(excessBytes / 3));
    charLength -= shrinkBy;
    sliced = html.slice(0, charLength);
  }

  // Trim to the last complete word / safe character to avoid broken entities or tags.
  const lastSafe = Math.max(
    sliced.lastIndexOf(' '),
    sliced.lastIndexOf('>'),
  );

  const safeSlice = lastSafe > 0 ? sliced.slice(0, lastSafe) : sliced;

  return (
    safeSlice +
    '<p><em>[Content truncated — open the original article for the full text]</em></p>'
  );
}
