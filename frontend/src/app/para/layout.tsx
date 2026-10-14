import styles from '../landing/landing.module.scss';

// Mesmo escopo visual da landing (tokens e fontes em .root); as fontes vêm do layout raiz.
export default function SegmentLayout({ children }: { children: React.ReactNode }) {
  return <div className={styles.root}>{children}</div>;
}
