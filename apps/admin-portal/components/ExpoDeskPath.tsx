/**
 * Read-only Expo desk path line for the Next portal. Never a write control —
 * operators open the path in the Expo app. Used on Product, Coverage, and Revenue footers.
 * Owner: PORTAL.
 */

/**
 * @purpose Show an Expo `/admin` path so oversight pages name the owning desk without implying a portal write.
 * @param path Expo Router admin path.
 * @param title Optional short desk name shown before the path.
 */
export function ExpoDeskPath({ path, title }: { path: string; title?: string }) {
  return (
    <p className="mt-2 text-sm font-extrabold text-[var(--jade)]">
      {title ? <span className="text-[var(--ink)]">{title} · </span> : null}
      <code className="rounded bg-[var(--jade-soft)] px-1.5 py-0.5 text-[var(--jade)]">{path}</code>
    </p>
  );
}
