import type { ReactNode } from 'react';
import { Info, Lightbulb, TriangleAlert } from 'lucide-react';
import styles from './docs.module.scss';

const KINDS = {
    info: { label: 'Bom saber', Icon: Info },
    tip: { label: 'Dica', Icon: Lightbulb },
    warning: { label: 'Atenção', Icon: TriangleAlert },
} as const;

interface CalloutProps {
    type?: keyof typeof KINDS;
    title?: string;
    children: ReactNode;
}

export function Callout({ type = 'info', title, children }: CalloutProps) {
    const { label, Icon } = KINDS[type];
    return (
        <aside className={`${styles.callout} ${styles[`callout_${type}`]}`}>
            <p className={styles.calloutTitle}>
                <Icon size={15} aria-hidden="true" /> {title ?? label}
            </p>
            <div className={styles.calloutBody}>{children}</div>
        </aside>
    );
}
