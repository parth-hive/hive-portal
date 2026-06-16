const AGREEMENTS_URL = "https://agreements.hiveny.com/";

export const metadata = {
  title: "Agreements",
};

export default function AgreementsPage() {
  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col">
      <header className="flex flex-wrap items-end justify-between gap-3 pb-6">
        <div>
          <h1 className="text-3xl tracking-tight text-ink">
            <span className="font-display text-accent-text">Agreements</span>
          </h1>
          <p className="mt-1 text-sm text-muted">
            Generate a sublease agreement PDF. New York units go out without
            letterhead; everything else includes it.
          </p>
        </div>
        <a
          href={AGREEMENTS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="whitespace-nowrap rounded-full border border-stone bg-white px-4 py-2 text-xs font-medium uppercase tracking-wide text-ink transition hover:border-accent hover:text-accent-text"
        >
          Open in new tab ↗
        </a>
      </header>

      <iframe
        src={AGREEMENTS_URL}
        title="Hive Lease Agreement Generator"
        className="h-[calc(100vh-13rem)] min-h-[560px] w-full rounded-2xl border border-stone/40 bg-white shadow-sm"
      />
    </div>
  );
}
