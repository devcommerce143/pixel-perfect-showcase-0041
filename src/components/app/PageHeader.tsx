import type { ReactNode } from "react";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b bg-card px-4 py-4 md:flex-row md:items-end md:justify-between md:px-6">
      <div className="min-w-0">
        <h1 className="text-page-title">{title}</h1>
        {description && <p className="mt-0.5 text-subtle max-w-3xl">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PageBody({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-4 p-4 md:p-6">{children}</div>;
}

export function Section({ title, description, actions, children, className = "" }: {
  title?: string; description?: string; actions?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={`panel overflow-hidden ${className}`}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            {title && <h2 className="text-card-title">{title}</h2>}
            {description && <p className="text-caption">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}
