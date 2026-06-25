interface PlaceholderPageProps {
  eyebrow: string;
  title: string;
  summary: string;
  items: string[];
}

export function PlaceholderPage({ eyebrow, title, summary, items }: PlaceholderPageProps) {
  return (
    <section className="mx-auto flex min-h-[calc(100dvh-10rem)] max-w-6xl items-center">
      <div className="grid w-full gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-lg border border-[var(--ls-border)] bg-white p-6 shadow-[var(--ls-shadow)] md:p-8">
          <div className="text-xs font-semibold text-[var(--ls-eyebrow-text)]">{eyebrow}</div>
          <h2 className="mt-3 max-w-2xl text-3xl font-semibold text-[var(--ls-ink-strong)] md:text-4xl">
            {title}
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--ls-ink-soft)]">
            {summary}
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            <span className="rounded-full bg-[var(--ls-link-soft)] px-3 py-1.5 text-xs font-medium text-white">
              等待验收
            </span>
            <span className="rounded-full border border-[var(--ls-border)] bg-[var(--ls-panel-soft)] px-3 py-1.5 text-xs text-[var(--ls-ink-soft)]">
              v0 Shell
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-[var(--ls-border)] bg-[var(--ls-panel-soft)] p-5">
          <div className="text-sm font-semibold text-[var(--ls-ink-strong)]">后续接入点</div>
          <div className="mt-4 grid gap-3">
            {items.map((item, index) => (
              <div
                key={item}
                className="flex items-center gap-3 rounded-lg border border-[var(--ls-border)] bg-white px-4 py-3"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--ls-panel-soft)] text-xs font-semibold text-[var(--ls-link-soft)]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="text-sm text-[var(--ls-ink-strong)]">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
