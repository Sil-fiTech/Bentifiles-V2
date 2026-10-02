import type { ReactNode } from 'react';
import styles from './docs.module.scss';

// Uso no MDX: <Steps> + lista numerada (1. 2. 3.) com linhas em branco ao redor.
export function Steps({ children }: { children: ReactNode }) {
    return <div className={styles.stepsWrap}>{children}</div>;
}
