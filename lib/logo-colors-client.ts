"use client";
import { useEffect, useState } from "react";
import { extractLogoColors, type ColorPair } from "./card-colors";

const cache = new Map<string, Promise<ColorPair | undefined>>();
export function readLogoColors(source: string): Promise<ColorPair | undefined> {
  const existing = cache.get(source);
  if (existing) return existing;
  const result = new Promise<ColorPair | undefined>(resolve => {
    const image = new Image();
    const timer = setTimeout(() => resolve(undefined), 8000);
    image.onload = () => {
      clearTimeout(timer);
      try {
        const canvas = document.createElement("canvas");
        const scale = 64 / Math.max(image.naturalWidth, image.naturalHeight);
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) return resolve(undefined);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(extractLogoColors(context.getImageData(0, 0, canvas.width, canvas.height).data));
      } catch { resolve(undefined); }
    };
    image.onerror = () => { clearTimeout(timer); resolve(undefined); };
    image.src = source;
  });
  if (cache.size >= 24) cache.delete(cache.keys().next().value!);
  cache.set(source, result);
  return result;
}

export function useLogoColors(source: string, saved?: ColorPair) {
  const [result, setResult] = useState<{ source: string; colors?: ColorPair }>({ source: "" });
  useEffect(() => {
    if (!source || saved) return;
    let active = true;
    void readLogoColors(source).then(colors => { if (active) setResult({ source, colors }); });
    return () => { active = false; };
  }, [source, saved]);
  return saved || (result.source === source ? result.colors : undefined);
}
