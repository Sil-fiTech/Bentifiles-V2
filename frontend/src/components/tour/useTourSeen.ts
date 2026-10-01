import { useCallback, useSyncExternalStore } from 'react';
import type { TourId } from './tours';

const storageKey = (id: TourId) => `bentifiles:tour:${id}`;

// Reserva para quando o localStorage está indisponível (janela anônima, dados bloqueados).
const seenInMemory = new Set<TourId>();
const listeners = new Set<() => void>();

function readSeen(id: TourId): boolean {
    if (seenInMemory.has(id)) return true;
    try {
        return localStorage.getItem(storageKey(id)) === '1';
    } catch {
        return false;
    }
}

function subscribe(onChange: () => void) {
    listeners.add(onChange);
    window.addEventListener('storage', onChange);
    return () => {
        listeners.delete(onChange);
        window.removeEventListener('storage', onChange);
    };
}

/**
 * Indica se o usuário já abriu o guia desta página (para a lâmpada parar de pulsar).
 * No servidor retorna true, então o ponto de destaque nunca aparece na primeira renderização.
 */
export function useTourSeen(id?: TourId): [seen: boolean, markSeen: () => void] {
    const seen = useSyncExternalStore(
        subscribe,
        () => (id ? readSeen(id) : true),
        () => true,
    );

    const markSeen = useCallback(() => {
        if (!id) return;
        seenInMemory.add(id);
        try {
            localStorage.setItem(storageKey(id), '1');
        } catch { /* sem armazenamento: vale só até recarregar a página */ }
        listeners.forEach((listener) => listener());
    }, [id]);

    return [seen, markSeen];
}
