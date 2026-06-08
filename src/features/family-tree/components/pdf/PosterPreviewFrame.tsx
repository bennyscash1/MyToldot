'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import styles from '@/app/[locale]/tree/[shortCode]/poster/poster.module.css';

export function PosterPreviewFrame({ src }: { src: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = useState(0.55);
  const [contentHeight, setContentHeight] = useState(1414);

  const measureIframe = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument) return;
    const root = iframe.contentDocument.getElementById('pdf-root');
    if (root) {
      setContentHeight(Math.max(1414, Math.ceil(root.scrollHeight)));
    }
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      setScale(Math.min(w / 1000, 0.72));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setContentHeight(1414);
  }, [src]);

  const scaledHeight = contentHeight * scale;

  return (
    <div ref={wrapRef} className={styles.previewWrap} style={{ height: scaledHeight }}>
      <iframe
        ref={iframeRef}
        title="poster preview"
        src={src}
        className={styles.previewIframe}
        style={{
          height: contentHeight,
          transform: `translateX(-50%) scale(${scale})`,
        }}
        onLoad={measureIframe}
      />
    </div>
  );
}
