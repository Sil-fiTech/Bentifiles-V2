// backend/tests/googleDriveDriver.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const axiosMock = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn(), patch: vi.fn() }));
vi.mock('axios', () => ({ default: axiosMock }));
const refreshAccessToken = vi.hoisted(() => vi.fn());
vi.mock('../src/services/storage/googleOAuth', () => ({ refreshAccessToken }));
vi.mock('../src/services/storage/envelopeCrypto', () => ({ decryptField: (v: string) => v }));
const prismaMock = vi.hoisted(() => ({
  storageFolder: { findUnique: vi.fn(), create: vi.fn() },
  project: { findUnique: vi.fn() },
}));
vi.mock('../src/prisma', () => ({ default: prismaMock }));

import { createGoogleDriveDriver } from '../src/services/storage/googleDriveDriver';

const connection = { id: 'c1', encryptedRefreshToken: 'refresh', rootFolderId: 'root', sharedDriveId: null };
const input = { buffer: Buffer.from('%PDF'), mimetype: 'application/pdf', projectId: 'p1', displayName: 'rg.pdf' };
const httpError = (status: number, reason?: string) => ({ response: { status, data: { error: { errors: reason ? [{ reason }] : [] } } } });

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  refreshAccessToken.mockResolvedValue({ accessToken: 'at', expiresIn: 3600 });
  prismaMock.storageFolder.findUnique.mockResolvedValue({ folderId: 'proj-folder' });
});

describe('GoogleDriveDriver.put', () => {
  it('sobe na pasta do projeto e devolve o id do Drive', async () => {
    axiosMock.post.mockResolvedValue({ data: { id: 'drive-file-1' } });
    const stored = await createGoogleDriveDriver(connection).put(input);
    expect(stored).toEqual({
      storageProvider: 'GDRIVE', storageRef: 'drive-file-1', encryptedDek: null, iv: null, authTag: null, keyVersion: null, storageConnectionId: 'c1',
    });
    const [url, , config] = axiosMock.post.mock.calls[0]!;
    expect(url).toContain('uploadType=multipart');
    expect(url).toContain('supportsAllDrives=true');
    expect(config.headers.Authorization).toBe('Bearer at');
  });

  it('cria a pasta do projeto quando ainda não existe', async () => {
    prismaMock.storageFolder.findUnique.mockResolvedValue(null);
    prismaMock.project.findUnique.mockResolvedValue({ name: 'Processo Silva' });
    axiosMock.post
      .mockResolvedValueOnce({ data: { id: 'new-folder' } })
      .mockResolvedValueOnce({ data: { id: 'drive-file-2' } });
    await createGoogleDriveDriver(connection).put(input);
    expect(axiosMock.post.mock.calls[0]![1]).toMatchObject({ name: 'Processo Silva', mimeType: 'application/vnd.google-apps.folder', parents: ['root'] });
    expect(prismaMock.storageFolder.create).toHaveBeenCalledWith({ data: { connectionId: 'c1', projectId: 'p1', folderId: 'new-folder' } });
  });

  it('traduz cota cheia em QUOTA sem repetir', async () => {
    axiosMock.post.mockRejectedValue(httpError(403, 'storageQuotaExceeded'));
    await expect(createGoogleDriveDriver(connection).put(input)).rejects.toMatchObject({ code: 'QUOTA' });
    expect(axiosMock.post).toHaveBeenCalledTimes(1);
  });

  it('repete 3 vezes em 503 e então falha com UNAVAILABLE', async () => {
    axiosMock.post.mockRejectedValue(httpError(503));
    await expect(createGoogleDriveDriver(connection).put(input)).rejects.toMatchObject({ code: 'UNAVAILABLE' });
    expect(axiosMock.post).toHaveBeenCalledTimes(3);
  });

  it('recupera se a segunda tentativa funcionar', async () => {
    axiosMock.post.mockRejectedValueOnce(httpError(429)).mockResolvedValueOnce({ data: { id: 'ok' } });
    await expect(createGoogleDriveDriver(connection).put(input)).resolves.toMatchObject({ storageRef: 'ok' });
  });
});

describe('GoogleDriveDriver.get', () => {
  const ref = { storageProvider: 'GDRIVE' as const, storageRef: 'drive-file-1', encryptedDek: null, iv: null, authTag: null, keyVersion: null, purgedAt: null };

  it('baixa o conteúdo', async () => {
    axiosMock.get.mockResolvedValue({ data: Buffer.from('%PDF') });
    const buf = await createGoogleDriveDriver(connection).get(ref);
    expect(buf.toString()).toBe('%PDF');
    expect(axiosMock.get.mock.calls[0]![0]).toContain('alt=media');
  });

  it('traduz 404 em NOT_FOUND', async () => {
    axiosMock.get.mockRejectedValue(httpError(404));
    await expect(createGoogleDriveDriver(connection).get(ref)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('GoogleDriveDriver fixes', () => {
  it('duas subidas concorrentes em projeto novo criam a pasta uma vez', async () => {
    prismaMock.storageFolder.findUnique.mockResolvedValue(null);
    prismaMock.project.findUnique.mockResolvedValue({ name: 'Novo' });
    axiosMock.post.mockImplementation(async (url: string) => (url.includes('uploadType') ? { data: { id: 'f' } } : { data: { id: 'folder-1' } }));
    const driver = createGoogleDriveDriver(connection);
    await Promise.all([driver.put(input), driver.put(input)]);
    const folderPosts = axiosMock.post.mock.calls.filter(([u]) => !String(u).includes('uploadType'));
    expect(folderPosts).toHaveLength(1);
    expect(prismaMock.storageFolder.create).toHaveBeenCalledTimes(1);
  });

  it('P2002 ao gravar a pasta devolve a pasta existente', async () => {
    prismaMock.storageFolder.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ folderId: 'winner' });
    prismaMock.project.findUnique.mockResolvedValue({ name: 'Corrida' });
    prismaMock.storageFolder.create.mockRejectedValue({ code: 'P2002' });
    axiosMock.post.mockResolvedValueOnce({ data: { id: 'dup-folder' } }).mockResolvedValueOnce({ data: { id: 'file' } });
    await createGoogleDriveDriver({ ...connection, id: 'c-race' }).put({ ...input, projectId: 'p-race' });
    expect(axiosMock.post.mock.calls[1]![1]).toBeDefined();
    expect(String(axiosMock.post.mock.calls[1]![0])).toContain('uploadType=multipart');
    expect(axiosMock.post.mock.calls[1]![1].toString()).toContain('"parents":["winner"]');
  });

  it('403 de rate limit é repetido e recupera', async () => {
    axiosMock.post.mockRejectedValueOnce(httpError(403, 'userRateLimitExceeded')).mockResolvedValueOnce({ data: { id: 'ok2' } });
    await expect(createGoogleDriveDriver(connection).put(input)).resolves.toMatchObject({ storageRef: 'ok2' });
    expect(axiosMock.post).toHaveBeenCalledTimes(2);
  });

  it('403 insufficientPermissions vira AUTH_REVOKED sem repetir', async () => {
    axiosMock.post.mockRejectedValue(httpError(403, 'insufficientPermissions'));
    await expect(createGoogleDriveDriver(connection).put(input)).rejects.toMatchObject({ code: 'AUTH_REVOKED' });
    expect(axiosMock.post).toHaveBeenCalledTimes(1);
  });

  it('401 descarta o token em cache', async () => {
    const conn = { ...connection, id: 'c-401' };
    axiosMock.post.mockRejectedValueOnce(httpError(401)).mockResolvedValueOnce({ data: { id: 'x' } });
    await expect(createGoogleDriveDriver(conn).put(input)).rejects.toMatchObject({ code: 'UNAVAILABLE' });
    await createGoogleDriveDriver(conn).put(input);
    expect(refreshAccessToken).toHaveBeenCalledTimes(2);
  });
});
