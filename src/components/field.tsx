import type { ReactNode } from "react";

interface FieldProps {
  term: string;
  children: ReactNode;
  /** Qualifies the value, for example why it is absent. */
  detail?: ReactNode;
  /** Spans two grid columns, for long values such as addresses and URLs. */
  wide?: boolean;
}

/** One term and value pair inside a definition list. */
export function Field({ term, children, detail, wide }: FieldProps) {
  return (
    <div className={wide ? "col-span-2" : undefined}>
      <dt className="font-mono text-[10px] uppercase tracking-widest text-ink-faint">
        {term}
      </dt>
      <dd className="mt-1.5 text-sm text-ink">{children}</dd>
      {detail ? (
        <dd className="mt-1 text-xs leading-relaxed text-ink-faint">{detail}</dd>
      ) : null}
    </div>
  );
}
