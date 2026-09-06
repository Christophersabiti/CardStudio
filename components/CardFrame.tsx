"use client";
import { useEffect, useRef, useState } from "react";
export default function CardFrame({ children }: { children: React.ReactNode }) {
  const outer = useRef<HTMLDivElement>(null),
    inner = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ scale: 1, height: 300, width: 470 });
  useEffect(() => {
    const measure = () => {
      if (!outer.current || !inner.current) return;
      const width = inner.current.offsetWidth,
        height = inner.current.offsetHeight;
      const scale = Math.min(1, outer.current.clientWidth / Math.max(1, width));
      setSize({ scale, height: height * scale, width: width * scale });
    };
    const observer = new ResizeObserver(measure);
    if (outer.current) observer.observe(outer.current);
    if (inner.current) observer.observe(inner.current);
    measure();
    return () => observer.disconnect();
  }, []);
  return (
    <div
      ref={outer}
      className="w-full"
      style={{ height: size.height, position: "relative" }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          width: size.width,
          transform: "translateX(-50%)",
        }}
      >
        <div
          style={{
            transform: `scale(${size.scale})`,
            transformOrigin: "top left",
            width: "max-content",
          }}
        >
          <div
            ref={inner}
            className="cs-print"
            style={{ width: "max-content" }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
