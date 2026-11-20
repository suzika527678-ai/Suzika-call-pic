import React, { useEffect, useId, useRef, useState } from 'react';

interface BannerAd320x50Props {
  placement?: 'home' | 'gallery' | 'videos' | 'footer' | 'lightbox-top' | 'lightbox-mid' | 'lightbox-bottom' | string;
  className?: string;
}

const AD_KEY_320X50 = 'd116591f3d2e03ba5d0c1b3a572d79d1';
const AD_SCRIPT_SRC_320X50 = `https://bicea.org/22/${AD_KEY_320X50}`;

const buildIsolated320x50Html = (instanceId: string) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        width: 320px;
        height: 50px;
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
        'key': '${AD_KEY_320X50}',
        'format': 'iframe',
        'height': 50,
        'width': 320,
        'params': {}
      };
    </script>
    <script
      type="text/javascript"
      src="${AD_SCRIPT_SRC_320X50}"
      onerror="try{window.parent.postMessage({type:'suzika-bicea-320x50-blocked',id:'${instanceId}'},'*')}catch(e){}"
    ></script>
  </body>
</html>`;

export const BannerAd320x50: React.FC<BannerAd320x50Props> = React.memo(
  ({ placement = 'home', className = '' }) => {
    const instanceId = useId();
    const containerRef = useRef<HTMLElement>(null);
    const frameWrapperRef = useRef<HTMLDivElement>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const hasLoadedRef = useRef(false);
    const [isBlocked, setIsBlocked] = useState(false);
    const [shouldLoad, setShouldLoad] = useState(false);
    const [wrapperWidth, setWrapperWidth] = useState<number>(320);

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
          event.data.type === 'suzika-bicea-320x50-blocked' &&
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

      // Guarantee single load across StrictMode double-mounts and parent re-renders
      if (hasLoadedRef.current || iframeEl.dataset.adLoaded === AD_KEY_320X50) {
        return;
      }

      hasLoadedRef.current = true;
      iframeEl.dataset.adLoaded = AD_KEY_320X50;

      try {
        iframeEl.srcdoc = buildIsolated320x50Html(instanceId);
      } catch {
        setIsBlocked(true);
      }
    }, [instanceId, isBlocked, shouldLoad]);

    if (isBlocked) {
      return null;
    }

    const scale = wrapperWidth > 0 ? Math.min(1.65, Math.max(0.75, wrapperWidth / 320)) : 1;
    const scaledHeight = Math.max(46, Math.round(50 * scale));

    return (
      <aside
        ref={containerRef}
        aria-label={`Mobile Banner Advertisement (${placement})`}
        className={`relative z-0 my-2 w-full max-w-full overflow-hidden flex flex-col items-center justify-center ${className}`}
      >
        <div
          ref={frameWrapperRef}
          style={{ height: `${scaledHeight}px` }}
          className="w-full max-w-2xl mx-auto rounded-xl sm:rounded-2xl overflow-hidden border border-[#252a3d] bg-[#0d111d] flex items-center justify-center shadow-sm"
        >
          <div
            style={{
              width: '320px',
              height: '50px',
              transform: `scale(${scale})`,
              transformOrigin: 'center center',
              flexShrink: 0,
            }}
            className="flex items-center justify-center"
          >
            <iframe
              ref={iframeRef}
              title={`Banner 320x50 ${placement}`}
              width={320}
              height={50}
              scrolling="no"
              frameBorder={0}
              sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-top-navigation-by-user-activation"
              className="w-[320px] h-[50px] border-0 block bg-transparent"
            />
          </div>
        </div>
      </aside>
    );
  },
  (prevProps, nextProps) =>
    prevProps.placement === nextProps.placement && prevProps.className === nextProps.className
);

BannerAd320x50.displayName = 'BannerAd320x50';
