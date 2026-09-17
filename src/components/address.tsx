"use client";

import { useEffect, useRef, useState } from "react";
import { truncateAddress } from "@/lib/format";

interface AddressProps {
  address: string;
  /** Block explorer URL. When omitted the address renders as plain text. */
  href?: string;
  /** Describes what the address is, for screen reader users. */
  label: string;
  lead?: number;
  tail?: number;
}

/**
 * A truncated address in monospace, with the full value always reachable:
 * the title attribute carries it, the explorer link resolves it, and the copy
 * control puts it on the clipboard.
 *
 * Client only because of the clipboard. The Overview is otherwise entirely
 * server rendered, and this is the only interactive control on it.
 */
export function Address({ address, href, label, lead, tail }: AddressProps) {
  const [copied, setCopied] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (timeout.current) clearTimeout(timeout.current);
    };
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      if (timeout.current) clearTimeout(timeout.current);
      timeout.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused. The full value is still in the title
      // attribute and behind the explorer link, so there is nothing to recover.
    }
  }

  const shown = truncateAddress(address, lead, tail);

  return (
    <span className="inline-flex items-center gap-2">
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          title={address}
          className="font-mono text-ink underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-accent"
        >
          <span className="sr-only">{label}: </span>
          {shown}
        </a>
      ) : (
        <span title={address} className="font-mono text-ink">
          <span className="sr-only">{label}: </span>
          {shown}
        </span>
      )}
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy full ${label.toLowerCase()}`}
        className="shrink-0 cursor-pointer border border-control px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-ink-faint transition-colors hover:border-control-strong hover:text-ink-muted"
      >
        {copied ? "COPIED" : "COPY"}
      </button>
      <span aria-live="polite" className="sr-only">
        {copied ? `${label} copied to clipboard` : ""}
      </span>
    </span>
  );
}
