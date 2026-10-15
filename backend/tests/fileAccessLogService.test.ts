import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({ fileAccessLog: { createMany: vi.fn() } }));
vi.mock('../src/prisma', () => ({ default: prismaMock }));
const logError = vi.hoisted(() => vi.fn());
vi.mock('../src/utils/logger', () => ({ logError, logInfo: vi.fn(), logWarn: vi.fn() }));

import { logFileAccess } from '../src/services/fileAccessLogService';

beforeEach(() => vi.clearAllMocks());

describe('logFileAccess', () => {
  it('grava todas as entradas de uma vez', async () => {
    prismaMock.fileAccessLog.createMany.mockResolvedValue({ count: 2 });
    await logFileAccess([
      { fileId: 'f1', userId: 'u1', action: 'ZIP', ip: '1.1.1.1' },
      { fileId: 'f2', userId: 'u1', action: 'ZIP', ip: '1.1.1.1' },
    ]);
    expect(prismaMock.fileAccessLog.createMany).toHaveBeenCalledWith({ data: expect.arrayContaining([expect.objectContaining({ fileId: 'f2' })]) });
  });

  it('não grava nada para lista vazia', async () => {
    await logFileAccess([]);
    expect(prismaMock.fileAccessLog.createMany).not.toHaveBeenCalled();
  });

  it('não derruba o download se o log falhar', async () => {
    prismaMock.fileAccessLog.createMany.mockRejectedValue(new Error('db down'));
    await expect(logFileAccess([{ fileId: 'f1', userId: 'u1', action: 'VIEW', ip: null }])).resolves.toBeUndefined();
    expect(logError).toHaveBeenCalled();
  });
});
