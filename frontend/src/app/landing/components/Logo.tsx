import Image from 'next/image';
import styles from './Logo.module.scss';

interface LogoProps {
  size?: number;
  wordmark?: boolean;
}

export default function Logo({ size = 56, wordmark = true }: LogoProps) {
  return (
    <span className={styles.logo} style={{ '--size': `${size}px` } as React.CSSProperties}>
      <span className={styles.crop} aria-hidden="true">
        <Image
          src="/brand/bentifiles-mark.png"
          alt=""
          width={Math.round(size * 1.62 * 2)}
          height={Math.round(size * 1.62 * 2)}
          priority
        />
      </span>
      {wordmark && (
        <span className={styles.word}>
          Benti<span>Files</span>
        </span>
      )}
    </span>
  );
}
