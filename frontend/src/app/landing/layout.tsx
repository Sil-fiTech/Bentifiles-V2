import styles from './landing.module.scss';

// As fontes (--font-display, --font-body, --font-mono) vêm do layout raiz.
export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return <div className={styles.root}>{children}</div>;
}
