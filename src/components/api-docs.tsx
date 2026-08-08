/**
 * Shared UI primitives for API reference pages — used by both the public
 * docs (`/docs/inventory-api`) and the portal's Developers tab
 * (`/developers`). Extracted from the original inventory docs page.
 */

export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8 rounded-xl bg-white p-6 shadow-sm ring-1 ring-stone/40">
      <h2 className="text-lg font-medium text-ink">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-ink">
        {children}
      </div>
    </section>
  );
}

export function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-warm/70 px-1.5 py-0.5 font-mono text-[0.8125rem] text-ink">
      {children}
    </code>
  );
}

export function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg bg-ink p-4 font-mono text-xs leading-relaxed text-cream">
      <code>{children}</code>
    </pre>
  );
}

export function ParamTable({
  header = ["Param", "Values", "Default"],
  rows,
}: {
  header?: [string, string, string];
  rows: [string, string, string][];
}) {
  return (
    <div className="overflow-x-auto rounded-lg ring-1 ring-stone/40">
      <table className="w-full text-sm">
        <thead className="bg-warm/60 text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            {header.map((h, i) => (
              <th key={i} className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([a, b, c]) => (
            <tr key={a + c} className="border-t border-stone/30">
              <td className="px-3 py-2 font-mono text-xs text-accent-text">
                {a}
              </td>
              <td className="px-3 py-2 text-ink">{b}</td>
              <td className="px-3 py-2 text-muted">{c}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
