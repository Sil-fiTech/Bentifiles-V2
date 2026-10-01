'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import type { TourStep } from './tours';
import styles from './GuidedTour.module.scss';

interface GuidedTourProps {
    steps: TourStep[];
    open: boolean;
    onClose: () => void;
}

interface Box { top: number; left: number; width: number; height: number; }

const SPOT_PAD = 6;
const GAP = 12;
const MARGIN = 12;
const SHEET_BREAKPOINT = 640;

const prefersReducedMotion = () =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function findTarget(target?: string): HTMLElement | null {
    if (!target) return null;
    return document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
}

function isVisible(el: HTMLElement): boolean {
    if (el.getClientRects().length === 0) return false;
    const style = window.getComputedStyle(el);
    return style.visibility !== 'hidden' && style.display !== 'none';
}

// Passos sem alvo são cartões centrais; passos com alvo só entram se o elemento estiver visível,
// a menos que sejam marcados para aparecer como cartão mesmo sem ele.
function availableSteps(steps: TourStep[]): TourStep[] {
    return steps.filter((step) => {
        if (!step.target || step.showWithoutTarget) return true;
        const el = findTarget(step.target);
        return !!el && isVisible(el);
    });
}

function reveal(el: HTMLElement, isSheet: boolean) {
    // Elementos do cabeçalho fixo ficam sempre na tela.
    if (el.closest('header')) return;
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const bottomLimit = isSheet ? vh * 0.55 : vh - 80;
    if (rect.top >= 80 && rect.bottom <= bottomLimit) return;
    const desiredTop = isSheet ? vh * 0.12 : vh * 0.25;
    window.scrollBy({ top: rect.top - desiredTop, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

export default function GuidedTour({ steps, open, onClose }: GuidedTourProps) {
    const [queue, setQueue] = useState<TourStep[]>([]);
    const [index, setIndex] = useState(0);
    const [box, setBox] = useState<Box | null>(null);
    const [popSize, setPopSize] = useState({ width: 0, height: 0 });
    const [viewport, setViewport] = useState({ width: 0, height: 0 });
    const popRef = useRef<HTMLDivElement>(null);
    const returnFocusRef = useRef<HTMLElement | null>(null);

    const step = queue[index];
    const isSheet = viewport.width > 0 && viewport.width < SHEET_BREAKPOINT;
    const isLast = index === queue.length - 1;

    // Monta a fila de passos disponíveis a cada abertura.
    useEffect(() => {
        if (!open) return;
        returnFocusRef.current = document.activeElement as HTMLElement | null;
        const list = availableSteps(steps);
        if (list.length === 0) { onClose(); return; }
        setQueue(list);
        setIndex(0);
        setViewport({ width: window.innerWidth, height: window.innerHeight });
        return () => {
            returnFocusRef.current?.focus?.();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const measure = useCallback(() => {
        setViewport({ width: window.innerWidth, height: window.innerHeight });
        const el = findTarget(step?.target);
        if (!el || !isVisible(el)) { setBox(null); return; }
        const r = el.getBoundingClientRect();
        setBox({ top: r.top - SPOT_PAD, left: r.left - SPOT_PAD, width: r.width + SPOT_PAD * 2, height: r.height + SPOT_PAD * 2 });
    }, [step]);

    // Rola até o alvo e acompanha scroll/resize enquanto o passo está ativo.
    useLayoutEffect(() => {
        if (!open || !step) return;
        const el = findTarget(step.target);
        if (el) reveal(el, window.innerWidth < SHEET_BREAKPOINT);
        measure();
        let raf = 0;
        const onChange = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure); };
        window.addEventListener('scroll', onChange, true);
        window.addEventListener('resize', onChange);
        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('scroll', onChange, true);
            window.removeEventListener('resize', onChange);
        };
    }, [open, step, measure]);

    useLayoutEffect(() => {
        if (!open || !popRef.current) return;
        const r = popRef.current.getBoundingClientRect();
        setPopSize((prev) => (prev.width === r.width && prev.height === r.height ? prev : { width: r.width, height: r.height }));
    }, [open, step, viewport.width]);

    const next = useCallback(() => {
        if (isLast) onClose(); else setIndex((i) => i + 1);
    }, [isLast, onClose]);
    const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

    // Teclado: setas navegam, Esc fecha, Tab fica dentro do balão.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
            if (e.key === 'ArrowRight') { e.preventDefault(); next(); return; }
            if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); return; }
            if (e.key !== 'Tab' || !popRef.current) return;
            const focusable = popRef.current.querySelectorAll<HTMLElement>('button:not([disabled])');
            if (focusable.length === 0) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const active = document.activeElement;
            if (!popRef.current.contains(active)) { e.preventDefault(); first.focus(); }
            else if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, next, prev, onClose]);

    // Leva o foco para o botão principal a cada passo.
    useEffect(() => {
        if (!open || !step) return;
        popRef.current?.querySelector<HTMLElement>('[data-tour-primary]')?.focus({ preventScroll: true });
    }, [open, step]);

    if (!open || !step || typeof document === 'undefined') return null;

    // Posição do balão (desktop). No celular ele vira uma folha fixa na base da tela.
    let popStyle: React.CSSProperties = {};
    if (!isSheet) {
        if (!box) {
            popStyle = {
                top: Math.max(MARGIN, (viewport.height - popSize.height) / 2),
                left: Math.max(MARGIN, (viewport.width - popSize.width) / 2),
            };
        } else {
            let top = box.top + box.height + GAP;
            if (top + popSize.height > viewport.height - MARGIN) {
                const above = box.top - GAP - popSize.height;
                top = above >= MARGIN ? above : viewport.height - popSize.height - MARGIN;
            }
            const left = Math.min(Math.max(box.left, MARGIN), Math.max(MARGIN, viewport.width - popSize.width - MARGIN));
            popStyle = { top, left };
        }
    }

    const titleId = 'guided-tour-title';
    const bodyId = 'guided-tour-body';

    return createPortal(
        <div className={styles.root}>
            <div className={`${styles.backdrop} ${box ? styles.backdropClear : ''}`} />
            {box && (
                <div
                    className={styles.spot}
                    style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
                    aria-hidden="true"
                />
            )}
            <div
                ref={popRef}
                className={`${styles.popover} ${isSheet ? styles.sheet : ''}`}
                style={popStyle}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={bodyId}
            >
                <div className={styles.head}>
                    <span className={styles.progress} aria-live="polite">
                        Passo {index + 1} de {queue.length}
                    </span>
                    <button type="button" className={styles.close} onClick={onClose} aria-label="Fechar guia">
                        <X size={16} />
                    </button>
                </div>
                <h2 id={titleId} className={styles.title}>{step.title}</h2>
                <p id={bodyId} className={styles.body}>{step.body}</p>
                <div className={styles.foot}>
                    <div className={styles.dots} aria-hidden="true">
                        {queue.map((s, i) => (
                            <span key={s.title} className={`${styles.dot} ${i === index ? styles.dotActive : ''}`} />
                        ))}
                    </div>
                    <div className={styles.actions}>
                        {index > 0 && (
                            <button type="button" className={styles.ghost} onClick={prev}>
                                <ArrowLeft size={14} /> Voltar
                            </button>
                        )}
                        <button type="button" className={styles.primary} onClick={next} data-tour-primary>
                            {isLast ? 'Concluir' : 'Próximo'} {!isLast && <ArrowRight size={14} />}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body,
    );
}
