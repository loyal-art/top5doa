"use client";

import { useState, useRef, useEffect } from "react";

interface WatchVideoButtonProps {
  embedUrl: string;
}

export function WatchVideoButton({ embedUrl }: WatchVideoButtonProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const dragging = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, left: 0, top: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      setPos({
        left: dragStart.current.left + (e.clientX - dragStart.current.mx),
        top: dragStart.current.top + (e.clientY - dragStart.current.my),
      });
    };
    const onUp = () => { dragging.current = false; };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, []);

  const handleDragMouseDown = (e: React.MouseEvent) => {
    if (!panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    dragging.current = true;
    dragStart.current = { mx: e.clientX, my: e.clientY, left: rect.left, top: rect.top };
    e.preventDefault();
  };

  const style: React.CSSProperties = pos
    ? { position: "fixed", left: pos.left, top: pos.top, zIndex: 9999, width: 380 }
    : { position: "fixed", right: 24, bottom: 24, zIndex: 9999, width: 380 };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-mono tracking-widest border border-[#e8ff00] text-[#e8ff00] bg-[#e8ff00]/10 hover:bg-[#e8ff00]/20 transition-colors duration-200"
      >
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
        WATCH VIDEO
      </button>

      {open && (
        <div ref={panelRef} style={style} className="rounded-xl overflow-hidden shadow-2xl border border-neutral-700 bg-neutral-900 flex flex-col">
          <div
            onMouseDown={handleDragMouseDown}
            className="flex items-center justify-between px-3 py-2 bg-neutral-800 cursor-grab active:cursor-grabbing select-none border-b border-neutral-700"
          >
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-neutral-600" />
                <span className="w-2.5 h-2.5 rounded-full bg-neutral-600" />
                <span className="w-2.5 h-2.5 rounded-full bg-neutral-600" />
              </div>
              <span className="text-xs font-mono text-neutral-400 tracking-widest uppercase">
                Video
              </span>
            </div>
            <button
              onClick={() => { setOpen(false); setPos(null); }}
              className="w-6 h-6 flex items-center justify-center rounded-md text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"
            >
              ✕
            </button>
          </div>
          <div className="w-full bg-black" style={{ height: 240 }}>
            <iframe
              src={embedUrl}
              className="w-full h-full"
              allow="autoplay; encrypted-media"
              allowFullScreen
              title="Topic video"
            />
          </div>
        </div>
      )}
    </>
  );
}
