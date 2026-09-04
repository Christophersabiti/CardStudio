"use client";

import { useState } from "react";
import type { GroupData } from "@/lib/types";
import { parseMembersCsv } from "@/lib/csv";
import Section from "./FormSection";

const LABEL = "block text-[11.5px] font-semibold uppercase tracking-wide mb-1.5";
const INPUT =
  "w-full rounded-lg px-3 py-2.5 text-sm outline-none transition border focus:border-[var(--brand-primary)]";
const inputStyle = { background: "var(--field)", borderColor: "var(--field-line)", color: "var(--ink)" };
const labelStyle = { color: "var(--muted)" };

export default function GroupBuilderForm({
  data,
  setData,
}: {
  data: GroupData;
  setData: (d: GroupData) => void;
}) {
  const [fileName, setFileName] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const patch = (p: Partial<GroupData>) => setData({ ...data, ...p });

  function handleFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = (ev.target?.result as string) || "";
      const { members, errors } = parseMembersCsv(text);
      patch({ members });
      setErrors(errors);
    };
    reader.readAsText(file);
  }

  function clearFile() {
    setFileName("");
    setErrors([]);
    patch({ members: [] });
  }

  return (
    <form className="flex flex-col gap-4" autoComplete="off" onSubmit={(e) => e.preventDefault()}>
      <Section n={1} title="Group details">
        <div>
          <label className={LABEL} style={labelStyle}>Group name</label>
          <input className={INPUT} style={inputStyle} value={data.name}
            onChange={(e) => patch({ name: e.target.value })} placeholder="Sabtech Online Team" />
        </div>
        <div>
          <label className={LABEL} style={labelStyle}>Organization</label>
          <input className={INPUT} style={inputStyle} value={data.organization}
            onChange={(e) => patch({ organization: e.target.value })} placeholder="Sabtech Online" />
          <span className="text-[11.5px]" style={{ color: "var(--faint)" }}>
            Used for any person in the CSV that doesn&apos;t have their own organization column.
          </span>
        </div>
        <div>
          <label className={LABEL} style={labelStyle}>Tagline</label>
          <input className={INPUT} style={inputStyle} value={data.tagline}
            onChange={(e) => patch({ tagline: e.target.value })} placeholder="Say hello to the whole team." />
        </div>
      </Section>

      <Section n={2} title="Bulk contacts (CSV)">
        <div className="flex items-center gap-3 flex-wrap">
          <label
            className="inline-flex items-center gap-2 cursor-pointer rounded-full px-3.5 py-2 text-[13px] font-semibold w-max text-white"
            style={{ background: "var(--brand-secondary)" }}
          >
            {fileName ? "Replace CSV" : "Upload CSV"}
            <input
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </label>
          {fileName ? (
            <>
              <span className="text-sm font-medium truncate max-w-[220px]" style={{ color: "var(--ink)" }}>
                {fileName}
              </span>
              <button
                type="button"
                onClick={clearFile}
                className="text-xs cursor-pointer"
                style={{ color: "var(--muted)" }}
              >
                Remove
              </button>
            </>
          ) : null}
        </div>
        <span className="text-[11.5px]" style={{ color: "var(--faint)" }}>
          Header row required. Columns: First Name, Last Name, Title, Organization, Phone, Email
          (a single &quot;Name&quot; column also works). Up to 500 people.
        </span>

        {errors.length > 0 ? (
          <div
            className="rounded-lg border px-3 py-2.5 text-[11.5px] flex flex-col gap-1"
            style={{ borderColor: "var(--field-line)", color: "var(--muted)" }}
          >
            {errors.map((e, i) => (
              <span key={i}>{e}</span>
            ))}
          </div>
        ) : null}

        {data.members.length > 0 ? (
          <div>
            <div className={LABEL} style={labelStyle}>
              {data.members.length} {data.members.length === 1 ? "person" : "people"} parsed
            </div>
            <div
              className="rounded-lg border max-h-60 overflow-y-auto flex flex-col divide-y"
              style={{ borderColor: "var(--field-line)" }}
            >
              {data.members.map((m, i) => (
                <div key={i} className="px-3 py-2 text-sm flex items-baseline justify-between gap-3 min-w-0">
                  <span className="font-semibold truncate" style={{ color: "var(--ink)" }}>
                    {`${m.firstName} ${m.lastName}`.trim() || "Unnamed"}
                  </span>
                  <span className="text-[11.5px] truncate" style={{ color: "var(--faint)" }}>
                    {[m.title, m.phone || m.email].filter(Boolean).join(" · ")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Section>
    </form>
  );
}
