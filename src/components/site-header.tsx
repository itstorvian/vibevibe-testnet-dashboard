import Link from "next/link";
import { MainNav } from "@/components/main-nav";
import { activeSnapshot } from "@/data";


export function SiteHeader() {
  const { network, source } = activeSnapshot;

  return (
    <header className="border-b border-line bg-canvas">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between md:gap-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Link href="/" className="text-[15px] font-semibold tracking-tight text-ink">
            Vibe/Vibe Testnet Indexer
          </Link>
          <span className="border border-line px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-ink-faint">
            {network.name}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <MainNav />

          <a
            href={source.repositoryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-ink-muted underline decoration-line-strong underline-offset-4 transition-colors hover:text-ink hover:decoration-accent"
          >
            Source
          </a>
        </div>
      </div>
    </header>
  );
}
