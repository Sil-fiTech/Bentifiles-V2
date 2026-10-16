// backend/tests/documentController.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  file: { findUnique: vi.fn() },
  projectRequiredDocument: { findFirst: vi.fn() },
  clientDocument: { create: vi.fn() },
}));
vi.mock('../src/prisma', () => ({ default: prismaMock }));
const renameStoredFile = vi.hoisted(() => vi.fn());
vi.mock('../src/services/storage', () => ({ renameStoredFile }));
vi.mock('../src/services/storage/envelopeCrypto', () => ({ decryptField: (v: string) => v }));
vi.mock('../src/services/storage/serializeFile', () => ({ serializeFile: (f: unknown) => f }));

import { uploadClientDocument } from '../src/controllers/documentController';

const makeRes = () => {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
};

const makeReq = (role: 'ADMIN' | 'USER', userId = 'u1') => ({
  user: { userId },
  projectId: 'p1',
  projectRole: role,
  body: { documentTypeId: 'dt1', ownerUserId: userId, fileId: 'f1' },
}) as any;

describe('uploadClientDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.projectRequiredDocument.findFirst.mockResolvedValue({ id: 'req1' });
    prismaMock.clientDocument.create.mockResolvedValue({
      id: 'cd1',
      file: { storageProvider: 'R2', originalName: 'rg.pdf' },
      ownerUser: { name: 'Ana' },
      documentType: { name: 'RG' },
    });
  });

  it('recusa arquivo inexistente com 400', async () => {
    prismaMock.file.findUnique.mockResolvedValue(null);
    const res = makeRes();
    await uploadClientDocument(makeReq('ADMIN'), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Arquivo inválido para este projeto' });
    expect(prismaMock.clientDocument.create).not.toHaveBeenCalled();
  });

  it('recusa arquivo de outro projeto com 400', async () => {
    prismaMock.file.findUnique.mockResolvedValue({ id: 'f1', projectId: 'outro', userId: 'u1' });
    const res = makeRes();
    await uploadClientDocument(makeReq('ADMIN'), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prismaMock.clientDocument.create).not.toHaveBeenCalled();
    expect(renameStoredFile).not.toHaveBeenCalled();
  });

  it('ignora projectId do corpo e recusa arquivo de outro projeto', async () => {
    prismaMock.file.findUnique.mockResolvedValue({ id: 'f1', projectId: 'outro', userId: 'u1' });
    const req = makeReq('ADMIN');
    req.body.projectId = 'outro';
    const res = makeRes();
    await uploadClientDocument(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prismaMock.clientDocument.create).not.toHaveBeenCalled();
    expect(renameStoredFile).not.toHaveBeenCalled();
  });

  it('recusa com 403 quando USER anexa arquivo de outra pessoa', async () => {
    prismaMock.file.findUnique.mockResolvedValue({ id: 'f1', projectId: 'p1', userId: 'u2' });
    const res = makeRes();
    await uploadClientDocument(makeReq('USER'), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Acesso negado' });
    expect(prismaMock.clientDocument.create).not.toHaveBeenCalled();
  });

  it('permite ADMIN anexar arquivo de outro membro do mesmo projeto', async () => {
    prismaMock.file.findUnique.mockResolvedValue({ id: 'f1', projectId: 'p1', userId: 'u2' });
    const res = makeRes();
    await uploadClientDocument(makeReq('ADMIN'), res);
    expect(prismaMock.clientDocument.create).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('permite USER anexar o próprio arquivo do projeto', async () => {
    prismaMock.file.findUnique.mockResolvedValue({ id: 'f1', projectId: 'p1', userId: 'u1' });
    const res = makeRes();
    await uploadClientDocument(makeReq('USER'), res);
    expect(prismaMock.clientDocument.create).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
