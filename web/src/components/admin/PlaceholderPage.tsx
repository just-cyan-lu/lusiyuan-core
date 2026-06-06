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
        <div className="rounded-lg border border-[#d9e2ec] bg-white p-6 shadow-[0_18px_48px_rgba(91,117,150,0.13)] md:p-8">
          <div className="text-xs font-semibold text-[#8a6f5a]">{eyebrow}</div>
          <h2 className="mt-3 max-w-2xl text-3xl font-semibold text-[#172033] md:text-4xl">
            {title}
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#617188]">
            {summary}
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            <span className="rounded-full bg-[#6f8fb8] px-3 py-1.5 text-xs font-medium text-white">
              等待验收
            </span>
            <span className="rounded-full border border-[#d9e2ec] bg-[#f8fbff] px-3 py-1.5 text-xs text-[#66758a]">
              v0 Shell
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-[#d9e2ec] bg-[#f8fbff] p-5">
          <div className="text-sm font-semibold text-[#172033]">后续接入点</div>
          <div className="mt-4 grid gap-3">
            {items.map((item, index) => (
              <div
                key={item}
                className="flex items-center gap-3 rounded-lg border border-[#d9e2ec] bg-white px-4 py-3"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#eaf2fb] text-xs font-semibold text-[#5f7fa7]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="text-sm text-[#334155]">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
