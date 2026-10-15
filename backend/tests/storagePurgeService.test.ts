import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  project: { findMany: vi.fn(), update: vi.fn() },
  file: { findMany: vi.fn(), update: vi.fn() },
}));
vi.mock('../src/prisma', () => ({ default: prismaMock }));
const deleteStoredFile = vi.hoisted(() => vi.fn());
vi.mock('../src/services/storage', () => ({ deleteStoredFile }));
const sendProjectPurgeWarningEmail = vi.hoisted(() => vi.fn());
vi.mock('../src/services/emailService', () => ({ sendProjectPurgeWarningEmail }));
vi.mock('../src/utils/logger', () => ({ logError: vi.fn(), logInfo: vi.fn(), logWarn: vi.fn() }));

import { purgeableFilesWhere, runStoragePurgeCycle, warnableProjectsWhere } from '../src/services/storagePurgeService';

const now = new Date('2026-11-10T12:00:00Z');
const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.project.findMany.mockResolvedValue([]);
  prismaMock.file.findMany.mockResolvedValue([]);
  sendProjectPurgeWarningEmail.mockResolvedValue(true);
});

describe('purgeableFilesWhere', () => {
  it('pega só R2 não expurgado de projetos arquivados há 7+ dias ou excluídos', () => {
    expect(purgeableFilesWhere(now)).toEqual({
      purgedAt: null,
      storageProvider: 'R2',
      project: {
        OR: [
          { status: 'ARCHIVED', archivedAt: { not: null, lte: daysAgo(7) }, purgeWarningSentAt: { not: null, lte: daysAgo(1) } },
          { status: 'DELETED' },
        ],
      },
    });
  });
});

describe('warnableProjectsWhere', () => {
  it('avisa projetos arquivados há 6+ dias, uma vez só', () => {
    expect(warnableProjectsWhere(now)).toEqual({
      status: 'ARCHIVED',
      archivedAt: { lte: daysAgo(6) },
      purgeWarningSentAt: null,
    });
  });
});

describe('runStoragePurgeCycle', () => {
  it('apaga o objeto, destrói a chave e marca purgedAt', async () => {
    const file = { id: 'f1', storageProvider: 'R2', storageRef: 'k1', encryptedDek: 'd', iv: 'i', authTag: 't', keyVersion: 1, purgedAt: null };
    prismaMock.file.findMany.mockResolvedValueOnce([file]).mockResolvedValueOnce([]);

    const summary = await runStoragePurgeCycle({ now });

    expect(deleteStoredFile).toHaveBeenCalledWith(file);
    expect(prismaMock.file.update).toHaveBeenCalledWith({
      where: { id: 'f1' },
      data: { purgedAt: now, encryptedDek: null, iv: null, authTag: null },
    });
    expect(summary).toEqual({ warned: 0, purged: 1, failed: 0 });
  });

  it('segue o lote quando um arquivo falha e não marca o que falhou', async () => {
    const a = { id: 'a', storageRef: 'ka' };
    const b = { id: 'b', storageRef: 'kb' };
    prismaMock.file.findMany.mockResolvedValueOnce([a, b]).mockResolvedValueOnce([]);
    deleteStoredFile.mockRejectedValueOnce(new Error('r2 down')).mockResolvedValueOnce(undefined);

    const summary = await runStoragePurgeCycle({ now });

    expect(prismaMock.file.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.file.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'b' } }));
    expect(summary).toEqual({ warned: 0, purged: 1, failed: 1 });
  });

  it('não reprocessa no mesmo ciclo o arquivo que falhou', async () => {
    prismaMock.file.findMany.mockResolvedValueOnce([{ id: 'a', storageRef: 'ka' }]).mockResolvedValueOnce([]);
    deleteStoredFile.mockRejectedValueOnce(new Error('r2 down'));
    await runStoragePurgeCycle({ now });
    const secondQuery = prismaMock.file.findMany.mock.calls[1]?.[0];
    expect(secondQuery.where.id).toEqual({ notIn: ['a'] });
  });

  it('envia o aviso aos ADMINs e grava purgeWarningSentAt', async () => {
    prismaMock.project.findMany.mockResolvedValue([{
      id: 'p1', name: 'Processo Silva', archivedAt: daysAgo(6),
      members: [{ user: { email: 'adm@x.com', name: 'Ana' } }],
    }]);

    const summary = await runStoragePurgeCycle({ now });

    expect(sendProjectPurgeWarningEmail).toHaveBeenCalledWith({
      email: 'adm@x.com', name: 'Ana', projectName: 'Processo Silva', projectId: 'p1', purgeAt: daysAgo(-1),
    });
    expect(prismaMock.project.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { purgeWarningSentAt: now } });
    expect(summary.warned).toBe(1);
  });

  it('não marca o aviso quando todos os envios falham', async () => {
    prismaMock.project.findMany.mockResolvedValue([{
      id: 'p1', name: 'P', archivedAt: daysAgo(6),
      members: [{ user: { email: 'a@x.com', name: 'A' } }, { user: { email: 'b@x.com', name: 'B' } }],
    }]);
    sendProjectPurgeWarningEmail.mockResolvedValue(false);

    await runStoragePurgeCycle({ now });

    expect(prismaMock.project.update).not.toHaveBeenCalled();
  });

  it('marca o aviso quando o projeto não tem ADMIN', async () => {
    prismaMock.project.findMany.mockResolvedValue([{ id: 'p2', name: 'P', archivedAt: daysAgo(6), members: [] }]);

    await runStoragePurgeCycle({ now });

    expect(sendProjectPurgeWarningEmail).not.toHaveBeenCalled();
    expect(prismaMock.project.update).toHaveBeenCalledWith({ where: { id: 'p2' }, data: { purgeWarningSentAt: now } });
  });
});
