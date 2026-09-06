import { ReactNode } from "react";
import { PendingNavLink } from "@/components/pending-nav-link";

type BreadcrumbItem = {
  label: string;
  href?: string;
};

type PageHeaderProps = {
  eyebrow?: string;
  breadcrumbs?: BreadcrumbItem[];
  title: string;
  titleAside?: ReactNode;
  description?: string;
  actions?: ReactNode;
};

export function PageHeader({
  eyebrow,
  breadcrumbs,
  title,
  titleAside,
  description,
  actions,
}: PageHeaderProps) {
  return (
    <section className="section-header">
      <div>
        {breadcrumbs?.length ? (
          <nav className="breadcrumb" aria-label="Breadcrumb">
            {breadcrumbs.map((item, index) => (
              <span key={`${item.label}-${index}`} className="breadcrumb__item">
                {item.href ? (
                  <PendingNavLink href={item.href}>{item.label}</PendingNavLink>
                ) : (
                  <span>{item.label}</span>
                )}
              </span>
            ))}
          </nav>
        ) : null}
        {eyebrow ? <p className="section-header__eyebrow">{eyebrow}</p> : null}
        <div className="section-header__title-row">
          <h1>{title}</h1>
          {titleAside}
        </div>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="section-header__actions">{actions}</div> : null}
    </section>
  );
}
