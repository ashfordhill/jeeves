import type { ReactNode } from "react";
import { useId } from "react";

export interface NavigationItem {
  href: string;
  label: string;
  icon?: ReactNode;
  current?: boolean;
}

export interface ProductShellProps {
  name: string;
  tagline?: string;
  mark?: ReactNode;
  navigation: readonly NavigationItem[];
  footer?: ReactNode;
  children: ReactNode;
}

/** Links remain real anchors: routing and session ownership belong to the application. */
export function ProductShell({
  name,
  tagline,
  mark,
  navigation,
  footer,
  children,
}: ProductShellProps) {
  const mainId = useId();
  return (
    <div className="jui-shell">
      <a
        className="jui-skip"
        href={`#${mainId}`}
        onClick={(event) => {
          event.preventDefault();
          document.getElementById(mainId)?.focus();
        }}
      >
        Skip to content
      </a>
      <aside className="jui-sidebar" aria-label={`${name} workspace`}>
        <div className="jui-brand">
          <span className="jui-brand-name">
            {mark}
            {name}
          </span>
          {tagline && <span className="jui-brand-tagline">{tagline}</span>}
        </div>
        <nav aria-label="Workspace">
          {navigation.map((item) => (
            <a key={item.href} href={item.href} aria-current={item.current ? "page" : undefined}>
              {item.icon && <span aria-hidden="true">{item.icon}</span>}
              {item.label}
            </a>
          ))}
        </nav>
        {footer && <div className="jui-sidebar-footer">{footer}</div>}
      </aside>
      <main className="jui-main" id={mainId} tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="jui-page-header">
      <div>
        {eyebrow && <p className="jui-eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="jui-description">{description}</p>}
      </div>
      {actions && <div className="jui-header-actions">{actions}</div>}
    </header>
  );
}

export function Feedback({
  kind = "status",
  children,
}: {
  kind?: "status" | "error";
  children: ReactNode;
}) {
  return (
    <div
      className={`jui-feedback jui-feedback-${kind}`}
      role={kind === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="jui-empty">
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
