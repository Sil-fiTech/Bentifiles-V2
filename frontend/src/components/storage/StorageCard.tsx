'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { HardDrive, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import api from '@/lib/api';
import { getAuthHeaders } from '@/lib/authClient';
import { pickDriveFolder } from '@/lib/storage/googlePicker';
import styles from './StorageCard.module.scss';

interface ConnectionInfo {
    googleAccountEmail: string;
    status: 'ACTIVE' | 'REVOKED';
    rootFolderId: string | null;
    sharedDriveId: string | null;
    lastError: string | null;
}

interface ConnectionResponse {
    canManage: boolean;
    scope: 'OFFICE' | 'USER' | null;
    connection: ConnectionInfo | null;
}

const ERROR_LABELS: Record<string, string> = {
    QUOTA: 'Seu Drive está sem espaço. Novos documentos estão sendo guardados no BentiFiles.',
    UNAVAILABLE: 'O Google Drive falhou recentemente. Novos documentos foram guardados no BentiFiles.',
    AUTH_REVOKED: 'O acesso ao Drive foi revogado. Reconecte para voltar a salvar lá.',
    NOT_FOUND: 'A pasta escolhida não foi encontrada no seu Drive. Escolha a pasta novamente.',
};

export default function StorageCard({ returnPath }: { returnPath: '/profile' | '/subscription' }) {
    const { data: session } = useSession();
    const searchParams = useSearchParams();
    const [data, setData] = useState<ConnectionResponse | null>(null);
    const [busy, setBusy] = useState(false);
    const token = session?.user?.token;
    const headers = getAuthHeaders(token);

    const load = useCallback(async () => {
        const res = await api.get('/api/storage/connection', { headers: getAuthHeaders(token) });
        setData(res.data);
    }, [token]);

    useEffect(() => {
        if (token) load().catch(() => setData(null));
    }, [token, load]);

    useEffect(() => {
        const status = searchParams.get('storage');
        if (status === 'connected') toast.success('Google Drive conectado. Agora escolha a pasta.');
        if (status === 'error') toast.error('Não foi possível conectar o Google Drive.');
    }, [searchParams]);

    if (!data?.canManage) return null;

    const run = async (fn: () => Promise<void>) => {
        setBusy(true);
        try { await fn(); await load(); }
        catch (error) { toast.error((error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Falha na operação com o Google Drive'); }
        finally { setBusy(false); }
    };

    const connect = () => run(async () => {
        const res = await api.get('/api/storage/google/connect', { params: { returnPath }, headers });
        window.location.href = res.data.url;
    });

    const createDefaultFolder = () => run(async () => {
        await api.post('/api/storage/google/folder', { mode: 'create' }, { headers });
        toast.success('Pasta "BentiFiles" criada no seu Drive.');
    });

    const chooseFolder = () => run(async () => {
        const tokenRes = await api.get('/api/storage/google/picker-token', { headers });
        const picked = await pickDriveFolder(tokenRes.data.accessToken);
        if (!picked) return;
        await api.post('/api/storage/google/folder', { mode: 'picked', ...picked }, { headers });
        toast.success('Pasta escolhida.');
    });

    const disconnect = () => run(async () => {
        if (!confirm('Desconectar o Google Drive? Os arquivos já salvos continuam no seu Drive; os novos passam a ser guardados no BentiFiles.')) return;
        await api.delete('/api/storage/google', { headers });
        toast.success('Google Drive desconectado.');
    });

    const connection = data.connection;
    const isActive = connection?.status === 'ACTIVE';

    return (
        <section className={styles.card}>
            <div className={styles.header}>
                <HardDrive size={20} />
                <div>
                    <h2 className={styles.title}>Armazenamento</h2>
                    <p className={styles.subtitle}>
                        {data.scope === 'OFFICE'
                            ? 'Os documentos de todos os projetos do escritório serão salvos neste Drive. Use um Drive compartilhado para o time inteiro ter acesso.'
                            : 'Salve os documentos dos seus projetos no seu próprio Google Drive.'}
                    </p>
                </div>
            </div>

            {!isActive && (
                <>
                    {connection?.status === 'REVOKED' && <p className={styles.warning}>Drive desconectado. Novos documentos estão sendo guardados no BentiFiles.</p>}
                    <div className={styles.actions}>
                        <button className={styles.primary} onClick={connect} disabled={busy}>
                            {busy ? <Loader2 size={16} className="animate-spin" /> : null} Conectar Google Drive
                        </button>
                    </div>
                </>
            )}

            {isActive && connection && (
                <>
                    <p className={styles.status}>Conectado como <strong>{connection.googleAccountEmail}</strong></p>
                    {connection.lastError && ERROR_LABELS[connection.lastError] && <p className={styles.warning}>{ERROR_LABELS[connection.lastError]}</p>}
                    {!connection.rootFolderId ? (
                        <div className={styles.actions}>
                            <button className={styles.primary} onClick={createDefaultFolder} disabled={busy}>Criar pasta &quot;BentiFiles&quot; no Meu Drive</button>
                            <button className={styles.secondary} onClick={chooseFolder} disabled={busy}>Escolher pasta (inclui Drive compartilhado)</button>
                        </div>
                    ) : (
                        <div className={styles.actions}>
                            <span className={styles.status}>{connection.sharedDriveId ? 'Salvando em um Drive compartilhado' : 'Salvando no Meu Drive'}</span>
                            <button className={styles.secondary} onClick={chooseFolder} disabled={busy}>Trocar pasta</button>
                            <button className={styles.danger} onClick={disconnect} disabled={busy}>Desconectar</button>
                        </div>
                    )}
                </>
            )}
        </section>
    );
}
