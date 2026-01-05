import { ReactNode } from 'react';
import Link from 'next/link';
import styles from './AuthCard.module.css';

interface AuthCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  backLink?: {
    href: string;
    label: string;
  };
}

export function AuthCard({ title, subtitle, children, footer, backLink }: AuthCardProps) {
  return (
    <div className={styles.card}>
      <h1 className={styles.title}>{title}</h1>
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      <div className={styles.content}>{children}</div>
      {footer && <div className={styles.footer}>{footer}</div>}
      {backLink && (
        <Link href={backLink.href} className={styles.backLink}>
          {backLink.label}
        </Link>
      )}
    </div>
  );
}

// Sub-components for footer
AuthCard.FooterLink = function FooterLink({
  href,
  children,
  primary,
}: {
  href: string;
  children: ReactNode;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`${styles.footerLink} ${primary ? styles.footerLinkPrimary : ''}`}
    >
      {children}
    </Link>
  );
};

AuthCard.FooterText = function FooterText({ children }: { children: ReactNode }) {
  return <span className={styles.footerText}>{children}</span>;
};

AuthCard.Separator = function Separator() {
  return <span className={styles.separator}>•</span>;
};

// Success state component
export function AuthSuccess({
  title,
  message,
  note,
  linkHref,
  linkLabel,
}: {
  title: string;
  message: string;
  note?: string;
  linkHref: string;
  linkLabel: string;
}) {
  return (
    <div className={styles.card}>
      <div className={styles.successIcon}>✓</div>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.subtitle}>{message}</p>
      {note && <p className={styles.note}>{note}</p>}
      <Link href={linkHref} className={styles.footerLinkPrimary} style={{
        display: 'inline-block',
        padding: '1rem 2rem',
        backgroundColor: '#e94560',
        borderRadius: '8px',
        color: 'white',
        textDecoration: 'none',
        fontWeight: 'bold',
      }}>
        {linkLabel}
      </Link>
    </div>
  );
}
