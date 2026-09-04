export default function FormSection({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-2xl border overflow-hidden"
      style={{ background: "var(--surface)", borderColor: "var(--line)" }}
    >
      <h2
        className="flex items-center gap-2.5 text-xs font-bold uppercase tracking-widest px-4 py-3.5 border-b"
        style={{ color: "var(--muted)", borderColor: "var(--line)" }}
      >
        <span
          className="grid place-items-center w-5.5 h-5.5 rounded-md text-[11px] text-white"
          style={{ background: "var(--brand-primary)", width: 22, height: 22 }}
        >
          {n}
        </span>
        {title}
      </h2>
      <div className="p-4 flex flex-col gap-3">{children}</div>
    </section>
  );
}
