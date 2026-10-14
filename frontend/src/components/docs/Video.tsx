'use client';

import { useState } from 'react';
import { Play, Clapperboard } from 'lucide-react';
import styles from './docs.module.scss';

interface VideoProps {
    /** ID do vídeo no YouTube (o trecho depois de "v=" ou de "youtu.be/"). Vídeos "não listados" funcionam. */
    id?: string;
    title: string;
    duration?: string;
}

// O player do YouTube só é carregado quando a pessoa clica, e usa o domínio sem cookies
// (youtube-nocookie.com). Assim a página não conversa com o YouTube antes do consentimento.
export function Video({ id, title, duration }: VideoProps) {
    const [playing, setPlaying] = useState(false);

    if (!id) {
        return (
            <figure className={styles.video}>
                <div className={`${styles.videoFrame} ${styles.videoSoon}`}>
                    <Clapperboard size={28} aria-hidden="true" />
                    <p className={styles.videoSoonTitle}>Vídeo em breve</p>
                    <p className={styles.videoSoonText}>{title}</p>
                </div>
            </figure>
        );
    }

    return (
        <figure className={styles.video}>
            <div className={styles.videoFrame}>
                {playing ? (
                    <iframe
                        src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0`}
                        title={title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                        allowFullScreen
                        referrerPolicy="strict-origin-when-cross-origin"
                    />
                ) : (
                    <button type="button" className={styles.videoPlay} onClick={() => setPlaying(true)}>
                        <span className={styles.videoPlayIcon}><Play size={26} fill="currentColor" aria-hidden="true" /></span>
                        <span className={styles.videoPlayTitle}>{title}</span>
                        <span className={styles.videoPlayHint}>
                            Clique para assistir{duration ? ` · ${duration}` : ''}
                        </span>
                    </button>
                )}
            </div>
            <figcaption className={styles.videoNote}>O vídeo é carregado do YouTube apenas depois do seu clique.</figcaption>
        </figure>
    );
}
