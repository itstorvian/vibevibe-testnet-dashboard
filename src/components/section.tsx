import type { ReactNode } from "react";

interface SectionProps {
  /** Id of the heading, referenced by the section's `aria-labelledby`. */
  id: string;
  /**
   * Stable in-page anchor, linked from the header navigation.
   *
   * Kept separate from the heading id so the anchor name stays stable if a
   * heading is ever renamed, and so `aria-labelledby` keeps pointing at the
   * heading rather than at the section itself.
   */
  anchorId?: string;
  title: string;
  /** One line of context. Sections without one are self explanatory. */
  description?: ReactNode;
  children: ReactNode;
}

/** A titled region. Deliberately not a card: a heading, a rule, content. */
export function Section({ id, anchorId, title, description, children }: SectionProps) {
  return (
    <section
      id={anchorId}
      aria-labelledby={id}
      /*
       * An anchor target is made programmatically focusable so that following
       * a header link moves focus here, not just the scroll position. Without
       * it a keyboard user lands visually on the section but keeps tabbing
       * from the top of the page.
       */
      tabIndex={anchorId ? -1 : undefined}
      className="mt-14 scroll-mt-8 first:mt-0"
    >
      <div className="mb-5 border-b border-line pb-3">
        <h2 id={id} className="text-base font-semibold tracking-tight text-ink">
          {title}
        </h2>
        {description ? (
          <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-ink-muted">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
