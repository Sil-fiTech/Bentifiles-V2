import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

const { fromFile, unlink } = vi.hoisted(() => ({
  fromFile: vi.fn(),
  unlink: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('file-type', () => ({ fromFile }));
vi.mock('fs', () => ({ default: { promises: { unlink } } }));

import { validateFileSignature } from '../src/middleware/fileSignatureValidator';

const makeRes = () => {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
};
const run = async (file?: object) => {
  const res = makeRes();
  const next = vi.fn();
  await validateFileSignature({ file } as Request, res as unknown as Response, next as NextFunction);
  return { res, next };
};
const upload = { path: '/tmp/u1', originalname: 'doc.pdf', mimetype: 'application/pdf' };

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('validateFileSignature', () => {
  it('segue em frente quando não há arquivo', async () => {
    const { next } = await run(undefined);
    expect(next).toHaveBeenCalledOnce();
    expect(fromFile).not.toHaveBeenCalled();
  });

  it('aceita tipo permitido', async () => {
    fromFile.mockResolvedValue({ mime: 'application/pdf' });
    const { next, res } = await run(upload);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejeita assinatura não reconhecida e apaga o temporário', async () => {
    fromFile.mockResolvedValue(undefined);
    const { next, res } = await run(upload);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(unlink).toHaveBeenCalledWith('/tmp/u1');
    expect(next).not.toHaveBeenCalled();
  });

  it('rejeita tipo fora da lista mesmo se o header disser PDF', async () => {
    fromFile.mockResolvedValue({ mime: 'application/x-msdownload' });
    const { next, res } = await run(upload);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(unlink).toHaveBeenCalledWith('/tmp/u1');
    expect(next).not.toHaveBeenCalled();
  });

  it('responde 500 e limpa o temporário se a leitura falhar', async () => {
    fromFile.mockRejectedValue(new Error('boom'));
    const { res } = await run(upload);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(unlink).toHaveBeenCalledWith('/tmp/u1');
  });
});
