"use client";

import { useState } from "react";
import { prepareImage } from "@/lib/image-client";
import type { CardData, Phone, PhoneType } from "@/lib/types";
import { SOCIALS } from "@/lib/socials";
import Section from "./FormSection";

const LABEL = "block text-[11.5px] font-semibold uppercase tracking-wide mb-1.5";
const INPUT =
  "w-full rounded-lg px-3 py-2.5 text-sm outline-none transition border focus:border-[var(--brand-primary)]";
const inputStyle = { background: "var(--field)", borderColor: "var(--field-line)", color: "var(--ink)" };
const labelStyle = { color: "var(--muted)" };

const PHONE_TYPES: PhoneType[] = ["CELL", "WORK", "HOME", "WHATSAPP", "OTHER"];

export default function BuilderForm({
  data,
  setData,
}: {
  data: CardData;
  setData: React.Dispatch<React.SetStateAction<CardData>>;
}) {
  const patch = (p: Partial<CardData>) => setData(current => ({ ...current, ...p }));

  const [imageError, setImageError] = useState("");
  const [imageBusy, setImageBusy] = useState(false);
  async function handleImage(file: File | undefined, field: "photo" | "logo") {
    if (!file) return;
    setImageError(""); setImageBusy(true);
    try { patch({ [field]: await prepareImage(file, field === "logo" ? 160 : 420, field === "logo") }); }
    catch (e) { setImageError(e instanceof Error ? e.message : "Could not read this image."); }
    finally { setImageBusy(false); }
  }
  // ---- dynamic list helpers ----
  const setPhone = (i: number, p: Partial<Phone>) => {
    const phones = data.phones.map((ph, idx) => (idx === i ? { ...ph, ...p } : ph));
    patch({ phones });
  };
  const addPhone = () => patch({ phones: [...data.phones, { type: "CELL", value: "" }] });
  const rmPhone = (i: number) => patch({ phones: data.phones.filter((_, idx) => idx !== i) });

  const setEmail = (i: number, v: string) => patch({ emails: data.emails.map((e, idx) => (idx === i ? v : e)) });
  const addEmail = () => patch({ emails: [...data.emails, ""] });
  const rmEmail = (i: number) => patch({ emails: data.emails.filter((_, idx) => idx !== i) });

  const setWeb = (i: number, v: string) => patch({ websites: data.websites.map((w, idx) => (idx === i ? v : w)) });
  const addWeb = () => patch({ websites: [...data.websites, ""] });
  const rmWeb = (i: number) => patch({ websites: data.websites.filter((_, idx) => idx !== i) });

  const setSocial = (key: string, v: string) => patch({ socials: { ...data.socials, [key]: v } });

  const removeBtn = (
    onClick: () => void,
  ) => (
    <button
      type="button"
      onClick={onClick}
      className="w-9 h-[38px] rounded-lg border text-lg leading-none cursor-pointer"
      style={{ background: "var(--field)", borderColor: "var(--field-line)", color: "var(--faint)" }}
      title="Remove"
      aria-label="Remove contact field"
    >
      ×
    </button>
  );

  const addBtn = (label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className="self-start inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold cursor-pointer border border-dashed"
      style={{
        color: "var(--brand-primary-deep)",
        background: "color-mix(in srgb, var(--brand-primary) 12%, transparent)",
        borderColor: "color-mix(in srgb, var(--brand-primary) 45%, transparent)",
      }}
    >
      + {label}
    </button>
  );

  return (
    <form className="flex flex-col gap-4" autoComplete="off" onSubmit={(e) => e.preventDefault()}>
      <Section n={1} title="Identity">
        {imageError && <p role="alert" className="cs-error">{imageError}</p>}
        {imageBusy && <p role="status" className="text-sm">Preparing image…</p>}
        <div className="flex gap-3.5 items-center">
          <div
            className="w-[74px] h-[74px] rounded-full grid place-items-center overflow-hidden flex-none border-2 font-display font-extrabold text-2xl"
            style={{
              background: "color-mix(in srgb, var(--brand-secondary) 12%, transparent)",
              borderColor: "var(--line-strong)",
              color: "var(--brand-secondary)",
            }}
          >
            {data.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.photo} alt="" className="w-full h-full object-cover" />
            ) : (
              <span>{(data.firstName[0] || "") + (data.lastName[0] || "") || "?"}</span>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              className="inline-flex items-center gap-2 cursor-pointer rounded-full px-3.5 py-2 text-[13px] font-semibold w-max text-white"
              style={{ background: "var(--brand-secondary)" }}
            >
              Upload photo
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                disabled={imageBusy}
                onChange={(e) => handleImage(e.target.files?.[0], "photo")}
              />
            </label>
            {data.photo ? (
              <button
                type="button"
                onClick={() => patch({ photo: "" })}
                className="text-xs text-left w-max cursor-pointer"
                style={{ color: "var(--muted)" }}
              >
                Remove photo
              </button>
            ) : null}
            <span className="text-[11.5px]" style={{ color: "var(--faint)" }}>
              Square image works best.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg grid place-items-center overflow-hidden flex-none border"
            style={{ background: "#fff", borderColor: "var(--line-strong)" }}
          >
            {data.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.logo} alt="" className="max-w-full max-h-full object-contain" />
            ) : (
              <span className="text-[8px] text-center leading-tight" style={{ color: "var(--faint)" }}>Logo</span>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label
              className="inline-flex items-center gap-2 cursor-pointer rounded-full px-3 py-1.5 text-[12px] font-semibold w-max border"
              style={{ borderColor: "var(--field-line)", color: "var(--ink)" }}
            >
              {data.logo ? "Replace logo" : "Upload logo"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                disabled={imageBusy}
                onChange={(e) => handleImage(e.target.files?.[0], "logo")}
              />
            </label>
            {data.logo ? (
              <button
                type="button"
                onClick={() => patch({ logo: "" })}
                className="text-xs text-left w-max cursor-pointer"
                style={{ color: "var(--muted)" }}
              >
                Remove logo
              </button>
            ) : null}
          </div>
          <span className="text-[11.5px] flex-1" style={{ color: "var(--faint)" }}>
            Optional — replaces the brand badge in the card&apos;s corner. Kept small, so it never
            affects the QR code&apos;s size.
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="card-firstName" className={LABEL} style={labelStyle}>First name</label>
            <input className={INPUT} style={inputStyle} id="card-firstName" value={data.firstName}
              onChange={(e) => patch({ firstName: e.target.value })} placeholder="Jane" />
          </div>
          <div>
            <label htmlFor="card-lastName" className={LABEL} style={labelStyle}>Last name</label>
            <input className={INPUT} style={inputStyle} id="card-lastName" value={data.lastName}
              onChange={(e) => patch({ lastName: e.target.value })} placeholder="Doe" />
          </div>
        </div>
        <div>
          <label htmlFor="card-title" className={LABEL} style={labelStyle}>Designation / Job title</label>
          <input className={INPUT} style={inputStyle} id="card-title" value={data.title}
            onChange={(e) => patch({ title: e.target.value })} placeholder="Product Manager" />
        </div>
        <div>
          <label htmlFor="card-organization" className={LABEL} style={labelStyle}>Company / Organization</label>
          <input className={INPUT} style={inputStyle} id="card-organization" value={data.organization}
            onChange={(e) => patch({ organization: e.target.value })} placeholder="Acme Inc." />
        </div>
      </Section>

      <Section n={2} title="Contact numbers">
        <div className="flex flex-col gap-2.5">
          {data.phones.map((p, i) => (
            <div key={i} className="grid gap-2 items-center" style={{ gridTemplateColumns: "96px 1fr 36px" }}>
              <select className={INPUT} style={inputStyle} aria-label={`Phone ${i + 1} type`} value={p.type}
                onChange={(e) => setPhone(i, { type: e.target.value as PhoneType })}>
                {PHONE_TYPES.map((t) => (
                  <option key={t} value={t}>{t[0] + t.slice(1).toLowerCase()}</option>
                ))}
              </select>
              <input className={INPUT} style={inputStyle} type="tel" aria-label={`Phone ${i + 1}`} value={p.value}
                onChange={(e) => setPhone(i, { value: e.target.value })} placeholder="+1 555 010 0100" />
              {removeBtn(() => rmPhone(i))}
            </div>
          ))}
        </div>
        {addBtn("Add phone number", addPhone)}
        <span className="text-[11.5px]" style={{ color: "var(--faint)" }}>
          Add two or more — mobile, work, WhatsApp. Use international format (+256…).
        </span>
      </Section>

      <Section n={3} title="Email & websites">
        <div className="flex flex-col gap-2.5">
          {data.emails.map((e, i) => (
            <div key={i} className="grid gap-2 items-center" style={{ gridTemplateColumns: "1fr 36px" }}>
              <input className={INPUT} style={inputStyle} type="email" aria-label={`Email ${i + 1}`} value={e}
                onChange={(ev) => setEmail(i, ev.target.value)} placeholder="name@email.com" />
              {removeBtn(() => rmEmail(i))}
            </div>
          ))}
        </div>
        {addBtn("Add email", addEmail)}
        <div className="h-0.5" />
        <div className="flex flex-col gap-2.5">
          {data.websites.map((w, i) => (
            <div key={i} className="grid gap-2 items-center" style={{ gridTemplateColumns: "1fr 36px" }}>
              <input className={INPUT} style={inputStyle} type="url" aria-label={`Website ${i + 1}`} value={w}
                onChange={(ev) => setWeb(i, ev.target.value)} placeholder="https://your-website.com" />
              {removeBtn(() => rmWeb(i))}
            </div>
          ))}
        </div>
        {addBtn("Add website", addWeb)}
      </Section>

      <Section n={4} title="Social media">
        <div className="grid grid-cols-2 gap-2.5">
          {SOCIALS.map((s) => (
            <div key={s.key} className="flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5"
              style={{ background: "var(--field)", borderColor: "var(--field-line)" }}>
              <span className="w-6.5 h-6.5 rounded-md grid place-items-center text-white flex-none"
                style={{ background: s.color, width: 26, height: 26 }} title={s.name}>
                <s.icon width={14} height={14} />
              </span>
              <input className="flex-1 min-w-0 bg-transparent border-0 outline-none py-1.5 text-sm"
                style={{ color: "var(--ink)" }} type="url" aria-label={s.name + " profile URL"} value={data.socials[s.key] || ""}
                onChange={(e) => setSocial(s.key, e.target.value)} placeholder={s.placeholder} />
            </div>
          ))}
        </div>
        <span className="text-[11.5px]" style={{ color: "var(--faint)" }}>
          Paste full profile links. Only the ones you fill in appear on the card.
        </span>
      </Section>

      <Section n={5} title="Personal details">
        <div>
          <label htmlFor="card-location" className={LABEL} style={labelStyle}>Location</label>
          <input className={INPUT} style={inputStyle} id="card-location" value={data.location}
            onChange={(e) => patch({ location: e.target.value })} placeholder="San Francisco, USA" />
        </div>
        <div>
          <label htmlFor="card-tagline" className={LABEL} style={labelStyle}>Tagline / short bio</label>
          <textarea className={INPUT + " min-h-[64px] resize-y"} style={inputStyle} id="card-tagline" value={data.tagline}
            onChange={(e) => patch({ tagline: e.target.value })} placeholder="Helping teams build better products." />
        </div>
        <div>
          <label htmlFor="card-role" className={LABEL} style={labelStyle}>Role / membership line</label>
          <input className={INPUT} style={inputStyle} id="card-role" value={data.role}
            onChange={(e) => patch({ role: e.target.value })} placeholder="Member, Industry Association" />
        </div>
      </Section>
    </form>
  );
}
