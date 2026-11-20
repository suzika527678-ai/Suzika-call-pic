export interface ParsedAdsterraSnippet {
  atOptionsJson?: string;
  scriptSrcs: { src: string; cfAsync?: string }[];
  containerIds: string[];
}

export type ParsedAdTag =
  | { kind: 'none'; isSocialBarConflict: false }
  | { kind: 'conflict'; isSocialBarConflict: true }
  | { kind: 'script_snippet'; snippet: ParsedAdsterraSnippet; isSocialBarConflict: false }
  | { kind: 'vast_or_script_url'; url: string; isDefinitelyScriptUrl: boolean; isSocialBarConflict: false };

export interface ResolvedVastCreative {
  mediaUrl: string;
  mediaType: string;
  clickThrough?: string;
  durationSeconds?: number;
  skipOffsetSeconds?: number;
  impressionUrls: string[];
  startUrls: string[];
  completeUrls: string[];
  closeUrls: string[];
  skipUrls: string[];
}

function normalizeUrlForCompare(url: string): string {
  return url.trim().toLowerCase().replace(/\/+$/, '');
}

export function isSocialBarUrlMatch(candidate: string, socialBarUrl?: string): boolean {
  const cleanCandidate = normalizeUrlForCompare(candidate);
  const cleanSocial = normalizeUrlForCompare(socialBarUrl || '');
  if (!cleanCandidate) return false;

  if (cleanSocial && cleanCandidate.includes(cleanSocial)) {
    return true;
  }

  return false;
}

export function isLikelyVastUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes('vast') ||
    lower.includes('.xml') ||
    lower.includes('vmap') ||
    lower.includes('vpaid')
  );
}

function isLikelyScriptUrl(url: string): boolean {
  if (isLikelyVastUrl(url)) {
    return false;
  }
  const lower = url.toLowerCase();
  return (
    lower.endsWith('.js') ||
    lower.includes('.js?') ||
    lower.includes('/invoke.js') ||
    /\/22\/[a-z0-9]{16,}/i.test(lower) ||
    /highperformanceformat\.com\//i.test(lower)
  );
}

/**
 * Parses an Adsterra tag configured in Admin Panel:
 * - Adsterra VAST XML URL (https://...)
 * - Adsterra Interstitial / Zone Script URL (https://...)
 * - Full Adsterra <script> HTML snippet (<script>atOptions=...</script><script src="https://..."></script> or native container div)
 * Rejects Social Bar scripts so they never conflict or double-fire.
 */
export function parseAdsterraTag(rawInput?: string, socialBarScriptUrl?: string): ParsedAdTag {
  const raw = (rawInput || '').trim();
  if (!raw) {
    return { kind: 'none', isSocialBarConflict: false };
  }

  // Case 1: HTML <script> snippet pasted from Adsterra dashboard
  if (raw.includes('<script')) {
    const scriptSrcs: { src: string; cfAsync?: string }[] = [];
    const scriptRegex = /<script\b([^>]*)>/gi;
    let match: RegExpExecArray | null;

    while ((match = scriptRegex.exec(raw)) !== null) {
      const attrs = match[1] || '';
      const srcMatch = attrs.match(/\bsrc\s*=\s*["'](https:\/\/[^"']+)["']/i);
      if (srcMatch?.[1]) {
        const srcUrl = srcMatch[1].trim();
        if (isSocialBarUrlMatch(srcUrl, socialBarScriptUrl)) {
          return { kind: 'conflict', isSocialBarConflict: true };
        }
        const cfMatch = attrs.match(/data-cfasync\s*=\s*["'](true|false)["']/i);
        scriptSrcs.push({ src: srcUrl, cfAsync: cfMatch?.[1] });
      }
    }

    if (scriptSrcs.length === 0) {
      return { kind: 'none', isSocialBarConflict: false };
    }

    // Extract safe atOptions config if present
    let atOptionsJson: string | undefined;
    const atOptionsKey = raw.match(/['"]?key['"]?\s*:\s*['"]([a-zA-Z0-9_-]{8,64})['"]/);
    if (atOptionsKey?.[1]) {
      const widthMatch = raw.match(/['"]?width['"]?\s*:\s*(\d{2,4})/);
      const heightMatch = raw.match(/['"]?height['"]?\s*:\s*(\d{2,4})/);
      const formatMatch = raw.match(/['"]?format['"]?\s*:\s*['"]([a-zA-Z0-9_-]+)['"]/);
      atOptionsJson = JSON.stringify({
        key: atOptionsKey[1],
        format: formatMatch?.[1] || 'iframe',
        height: heightMatch ? Number(heightMatch[1]) : 250,
        width: widthMatch ? Number(widthMatch[1]) : 300,
        params: {},
      });
    }

    // Extract safe container div IDs (e.g. Adsterra Native Banner container-xxxx)
    const containerIds: string[] = [];
    const divRegex = /<div\b[^>]*\bid\s*=\s*["']([a-zA-Z0-9_-]{4,80})["'][^>]*>/gi;
    let divMatch: RegExpExecArray | null;
    while ((divMatch = divRegex.exec(raw)) !== null) {
      if (divMatch[1]) containerIds.push(divMatch[1]);
    }

    return {
      kind: 'script_snippet',
      snippet: { atOptionsJson, scriptSrcs, containerIds },
      isSocialBarConflict: false,
    };
  }

  // Case 2: Single HTTPS URL (VAST XML URL or Interstitial/Zone Script URL)
  if (raw.startsWith('https://')) {
    if (isSocialBarUrlMatch(raw, socialBarScriptUrl)) {
      return { kind: 'conflict', isSocialBarConflict: true };
    }
    return {
      kind: 'vast_or_script_url',
      url: raw,
      isDefinitelyScriptUrl: isLikelyScriptUrl(raw),
      isSocialBarConflict: false,
    };
  }

  return { kind: 'none', isSocialBarConflict: false };
}

/**
 * Builds isolated HTML document for an Adsterra script snippet or script URL.
 * Runs completely sandboxed inside <iframe srcDoc> so window.atOptions and globals
 * never conflict with 300x250, 320x50 Banners, Google AdSense, or Social Bar.
 */
export function buildIsolatedAdsterraSrcDoc(
  instanceId: string,
  snippet: ParsedAdsterraSnippet
): string {
  const containersHtml = snippet.containerIds
    .map((id) => `<div id="${id}"></div>`)
    .join('\n');

  const atOptionsBlock = snippet.atOptionsJson
    ? `<script type="text/javascript">window.atOptions = ${snippet.atOptionsJson};</script>`
    : '';

  const scriptsHtml = snippet.scriptSrcs
    .map(
      ({ src, cfAsync }) =>
        `<script type="text/javascript" ${
          cfAsync ? `data-cfasync="${cfAsync}"` : ''
        } src="${src}" onload="window.__suzikaNotifyLoad && window.__suzikaNotifyLoad()" onerror="window.__suzikaNotifyFail && window.__suzikaNotifyFail('script_error')"></script>`
    )
    .join('\n');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        width: 100%;
        min-height: 100%;
        background: transparent;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        color: #fff;
        font-family: system-ui, -apple-system, sans-serif;
      }
      img, iframe {
        max-width: 100% !important;
      }
    </style>
    <script>
      (function() {
        var settled = false;
        function post(type, reason) {
          try {
            window.parent.postMessage({ type: type, id: '${instanceId}', reason: reason || '' }, '*');
          } catch (e) {}
        }
        function hasVisibleCreative() {
          var iframes = document.querySelectorAll('iframe');
          for (var i = 0; i < iframes.length; i++) {
            var r = iframes[i].getBoundingClientRect();
            if (r.width >= 40 && r.height >= 40) return true;
          }
          var imgs = document.querySelectorAll('img');
          for (var j = 0; j < imgs.length; j++) {
            var ir = imgs[j].getBoundingClientRect();
            if (ir.width >= 40 && ir.height >= 40) return true;
          }
          var videos = document.querySelectorAll('video');
          if (videos.length > 0) return true;
          var divs = document.querySelectorAll('div, a, ins');
          for (var k = 0; k < divs.length; k++) {
            var dr = divs[k].getBoundingClientRect();
            if (dr.width >= 100 && dr.height >= 45 && divs[k].children.length > 0) return true;
          }
          return false;
        }
        window.__suzikaNotifyFail = function(reason) {
          if (settled) return;
          settled = true;
          post('suzika-interstitial-failed', reason);
        };
        window.__suzikaNotifyLoad = function() {
          setTimeout(function() {
            if (settled) return;
            if (hasVisibleCreative()) {
              settled = true;
              post('suzika-interstitial-loaded');
            }
          }, 650);
          setTimeout(function() {
            if (settled) return;
            if (hasVisibleCreative()) {
              settled = true;
              post('suzika-interstitial-loaded');
            }
          }, 1800);
        };
        setTimeout(function() {
          if (!settled) {
            if (hasVisibleCreative()) {
              settled = true;
              post('suzika-interstitial-loaded');
            } else {
              settled = true;
              post('suzika-interstitial-failed', 'empty_or_blocked');
            }
          }
        }, 4200);
      })();
    </script>
  </head>
  <body>
    ${atOptionsBlock}
    ${containersHtml}
    ${scriptsHtml}
  </body>
</html>`;
}

function parseTimeStringToSeconds(raw?: string | null): number | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const parts = trimmed.split(':').map(Number);
  if (parts.length === 3 && parts.every((n) => !Number.isNaN(n))) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return undefined;
}

export function fireVastTrackingUrls(urls: string[]): void {
  urls.forEach((u) => {
    const clean = (u || '').trim();
    if (!clean.startsWith('http')) return;
    try {
      const img = new Image();
      img.referrerPolicy = 'no-referrer';
      img.src = clean;
    } catch {
      fetch(clean, { mode: 'no-cors', keepalive: true }).catch(() => {});
    }
  });
}

/**
 * Fetches and parses an Adsterra VAST 2.0/3.0/4.0 XML Video Ad Tag.
 * Supports VAST <InLine> and <Wrapper> chains (up to 2 hops).
 * Returns null safely on CORS, network timeout, ad blocker, or unfilled VAST.
 */
export async function resolveVastXml(
  vastUrl: string,
  depth = 0
): Promise<ResolvedVastCreative | null> {
  if (depth > 2 || !vastUrl || !vastUrl.startsWith('http')) return null;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 4200);

  try {
    const res = await fetch(vastUrl, {
      signal: controller.signal,
      headers: { Accept: 'application/xml, text/xml, */*' },
    });
    if (!res.ok) return null;

    const text = await res.text();
    if (!text || !text.includes('<VAST')) {
      return null;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/xml');

    const impressionUrls = Array.from(doc.getElementsByTagName('Impression'))
      .map((n) => n.textContent?.trim() || '')
      .filter((u) => u.startsWith('http'));

    const trackingsByEvent = (eventName: string) =>
      Array.from(doc.getElementsByTagName('Tracking'))
        .filter((n) => (n.getAttribute('event') || '').toLowerCase() === eventName)
        .map((n) => n.textContent?.trim() || '')
        .filter((u) => u.startsWith('http'));

    // Handle VAST Wrapper redirect
    const vastAdTagUri = doc.getElementsByTagName('VASTAdTagURI')[0]?.textContent?.trim();
    if (vastAdTagUri && vastAdTagUri.startsWith('http')) {
      const wrapped = await resolveVastXml(vastAdTagUri, depth + 1);
      if (!wrapped) return null;
      return {
        ...wrapped,
        impressionUrls: [...impressionUrls, ...wrapped.impressionUrls],
        startUrls: [...trackingsByEvent('start'), ...wrapped.startUrls],
        completeUrls: [...trackingsByEvent('complete'), ...wrapped.completeUrls],
        closeUrls: [...trackingsByEvent('close'), ...wrapped.closeUrls],
        skipUrls: [...trackingsByEvent('skip'), ...wrapped.skipUrls],
      };
    }

    const mediaFiles = Array.from(doc.getElementsByTagName('MediaFile'));
    const bestMedia =
      mediaFiles.find((n) => (n.getAttribute('type') || '').toLowerCase().includes('mp4')) ||
      mediaFiles.find((n) => (n.getAttribute('type') || '').toLowerCase().includes('webm')) ||
      mediaFiles[0];

    const mediaUrl = bestMedia?.textContent?.trim() || '';
    if (!mediaUrl.startsWith('http')) {
      return null;
    }

    const linearEl = doc.getElementsByTagName('Linear')[0];
    const skipOffsetSeconds = parseTimeStringToSeconds(linearEl?.getAttribute('skipoffset'));
    const durationSeconds = parseTimeStringToSeconds(
      doc.getElementsByTagName('Duration')[0]?.textContent
    );
    const clickThrough =
      doc.getElementsByTagName('ClickThrough')[0]?.textContent?.trim() || undefined;

    return {
      mediaUrl,
      mediaType: bestMedia?.getAttribute('type') || 'video/mp4',
      clickThrough: clickThrough?.startsWith('http') ? clickThrough : undefined,
      durationSeconds,
      skipOffsetSeconds,
      impressionUrls,
      startUrls: trackingsByEvent('start'),
      completeUrls: trackingsByEvent('complete'),
      closeUrls: trackingsByEvent('close'),
      skipUrls: trackingsByEvent('skip'),
    };
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}
