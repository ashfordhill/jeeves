/** Placeholder card shown until a view has real content. */
export function EmptyView({ title, children }: { title: string; children: string }) {
  return (
    <div className="empty-view">
      <h1>{title}</h1>
      <p>{children}</p>
    </div>
  );
}
