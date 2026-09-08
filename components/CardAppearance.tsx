"use client";
import type { CardData } from "@/lib/types";
import { useLogoColors } from "@/lib/logo-colors-client";

const choices = [
  { mode: "logo", title: "Color by logo", detail: "Default · soft tones from your logo" },
  { mode: "theme", title: "Current theme", detail: "The original Card Studio palette" },
  { mode: "custom", title: "Custom colors", detail: "Choose your own color pairing" },
] as const;

export default function CardAppearance({ data, onChange }: { data: CardData; onChange: (patch: Partial<CardData>) => void }) {
  const colors = useLogoColors(data.logo, data.logoColors);
  const appearance = data.appearance || { mode: "logo", primary: "#4f46e5", secondary: "#0f172a" };
  return <section className="cs-panel flex flex-col gap-4" aria-labelledby="appearance-title">
    <div><h2 id="appearance-title" className="text-base font-bold">Card colors</h2>
      <p className="text-sm cs-muted mt-2">A subtle gradient, a matching top accent, and readable details.</p></div>
    <div className="grid gap-2" role="group" aria-label="Card color source">
      {choices.map(choice => <button key={choice.mode} type="button" className="cs-color-choice" aria-pressed={appearance.mode === choice.mode}
        onClick={() => onChange({ appearance: { ...appearance, mode: choice.mode, ...(choice.mode === "custom" && !data.appearance ? { primary: colors?.[0] || appearance.primary, secondary: colors?.[1] || appearance.secondary } : {}) }, ...(colors ? { logoColors: colors } : {}) })}>
        <span className="cs-color-choice-dot" aria-hidden="true" />
        <span><span className="block font-semibold">{choice.title}</span><span className="block text-xs cs-muted mt-1">{choice.detail}</span></span>
      </button>)}
    </div>
    {appearance.mode === "logo" && <div className="text-sm cs-muted" role="status">
      {!data.logo ? "Upload a logo to match its colors. Without a logo, your current theme stays in place." : colors ? <span className="flex items-center gap-2">{colors.map((c, i) => <span key={i} className="cs-color-swatch" style={{ background: c }} aria-hidden="true" />)}Logo palette applied with softer backgrounds.</span> : "Using the current theme until logo colors are available. You can also choose custom colors."}
    </div>}
    {appearance.mode === "custom" && <div className="grid grid-cols-2 gap-3">
      {(["primary", "secondary"] as const).map((key, i) => <label key={key} className="text-sm font-semibold">
        {i === 0 ? "Primary color" : "Companion color"}
        <span className="flex flex-wrap items-center gap-2 mt-2"><input type="color" className="cs-color-input" value={appearance[key]} aria-label={i === 0 ? "Primary color" : "Companion color"}
          onChange={e => onChange({ appearance: { ...appearance, [key]: e.target.value } })} /><span className="text-xs cs-muted font-mono">{appearance[key].toUpperCase()}</span></span>
      </label>)}
    </div>}
    <p className="text-xs cs-muted">Bright colors are softened into gradients. Light and dark appearances follow each viewer’s device. Your logo and QR stay clear.</p>
  </section>;
}
