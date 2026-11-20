import React, { useEffect, useId, useRef, useState } from 'react';

interface BannerAd300x250Props {
  placement?: 'home' | 'gallery' | 'videos' | string;
  className?: string;
}

const AD_KEY = '7582598bfa55ed10e25bb7bba1896fab';
const AD_SCRIPT_SRC = `https://bicea.org/22/${AD_KEY}`;

const buildIsolatedAdHtml = (instanceId: string) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        width: 300px;
        height: 250px;
        overflow: hidden;
        background: transparent;
        display: flex;
        align-items: center;
        justify-content: center;
      }
    </style>
  </head>
  <body>
    <script type="text/javascript">
      window.atOptions = {
        'key': '${AD_KEY}',
        'format': 'iframe',
        'height': 250,
        'width': 300,
        'params': {}
      };
    </script>
    <script
      type="text/javascript"
      src="${AD_SCRIPT_SRC}"
      onerror="try{window.parent.postMessage({type:'suzika-bicea-ad-blocked',id:'${instanceId}'},'*')}catch(e){}"
    ></script>
  </body>
</html>`;

export const BannerAd300x250: React.FC<BannerAd300x250Props> = React.memo(
  ({ placement = 'home', className = '' }) => {
    const instanceId = useId();
    const containerRef = useRef<HTMLElement>(null);
    const frameWrapperRef = useRef<HTMLDivElement>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const hasLoadedRef = useRef(false);
    const [isBlocked, setIsBlocked] = useState(false);
    const [shouldLoad, setShouldLoad] = useState(false);
    const [wrapperWidth, setWrapperWidth] = useState<number>(300);

    useEffect(() => {
      const wrapperEl = frameWrapperRef.current;
      if (!wrapperEl) return;

      const updateWidth = () => {
        const nextWidth = wrapperEl.clientWidth;
        if (nextWidth > 0) {
          setWrapperWidth(nextWidth);
        }
      };

      updateWidth();

      if (typeof ResizeObserver === 'undefined') {
        window.addEventListener('resize', updateWidth);
        return () => window.removeEventListener('resize', updateWidth);
      }

      const ro = new ResizeObserver(updateWidth);
      ro.observe(wrapperEl);
      return () => ro.disconnect();
    }, []);

    useEffect(() => {
      const handleMessage = (event: MessageEvent) => {
        if (
          event.data &&
          event.data.type === 'suzika-bicea-ad-blocked' &&
          event.data.id === instanceId
        ) {
          setIsBlocked(true);
        }
      };

      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }, [instanceId]);

    useEffect(() => {
      const el = containerRef.current;
      if (!el || shouldLoad) return;

      if (typeof IntersectionObserver === 'undefined') {
        setShouldLoad(true);
        return;
      }

      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            setShouldLoad(true);
            observer.disconnect();
          }
        },
        { rootMargin: '500px 0px' }
      );

      observer.observe(el);
      return () => observer.disconnect();
    }, [shouldLoad]);

    useEffect(() => {
      const iframeEl = iframeRef.current;
      if (!iframeEl || isBlocked || !shouldLoad) return;

      // Prevent duplicate script execution across React re-renders and StrictMode double-mounts
      if (hasLoadedRef.current || iframeEl.dataset.adLoaded === AD_KEY) {
        return;
      }

      hasLoadedRef.current = true;
      iframeEl.dataset.adLoaded = AD_KEY;

      try {
        iframeEl.srcdoc = buildIsolatedAdHtml(instanceId);
      } catch {
        setIsBlocked(true);
      }
    }, [instanceId, isBlocked, shouldLoad]);

    // Fail-safe for Ad Blockers: hide ad container gracefully without disturbing page layout
    if (isBlocked) {
      return null;
    }

    const scale = wrapperWidth > 0 ? Math.min(1.4, Math.max(0.75, wrapperWidth / 300)) : 1;
    const scaledHeight = Math.max(210, Math.round(250 * scale));

    return (
      <aside
        ref={containerRef}
        aria-label={`Advertisement (${placement})`}
        className={`relative z-0 my-3 w-full max-w-full overflow-hidden flex flex-col items-center justify-center ${className}`}
      >
        <span className="text-[10px] uppercase tracking-wider text-[#7e859b] mb-1 select-none">
          Advertisement
        </span>

        <div
          ref={frameWrapperRef}
          style={{ height: `${scaledHeight}px` }}
          className="w-full max-w-2xl sm:max-w-[420px] mx-auto rounded-xl sm:rounded-2xl overflow-hidden border border-[#252a3d] bg-[#0d111d] flex items-center justify-center shadow-md"
        >
          <div
            style={{
              width: '300px',
              height: '250px',
              transform: `scale(${scale})`,
              transformOrigin: 'center center',
              flexShrink: 0,
            }}
            className="flex items-center justify-center"
          >
            <iframe
              ref={iframeRef}
              title={`Banner Ad ${placement}`}
              width={300}
              height={250}
              scrolling="no"
              frameBorder={0}
              sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-top-navigation-by-user-activation"
              className="w-[300px] h-[250px] border-0 block bg-transparent"
            />
          </div>
        </div>
      </aside>
    );
  },
  // Never re-render due to parent slideshow/state updates once mounted for this placement
  (prevProps, nextProps) =>
    prevProps.placement === nextProps.placement && prevProps.className === nextProps.className
);

BannerAd300x250.displayName = 'BannerAd300x250';
