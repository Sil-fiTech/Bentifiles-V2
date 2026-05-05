import { Router } from 'express';
import { uploadFile, getFiles, getFileBase64, getDashboardStats, getPendingFiles, getProjectFilesBase64 } from '../controllers/fileController';
import { upload } from '../middleware/upload';
import { authenticateToken } from '../middleware/auth';
import { requireProductAccess } from '../middleware/requireProductAccess';
import { checkRole } from '../middleware/roleMiddleware';
import { checkProjectNotArchived } from '../middleware/projectStatusMiddleware';

import { validateFileSignature } from '../middleware/fileSignatureValidator';

const router = Router();

// Note: for multipart/form-data uploads, `projectId` is only available in `req.body`
// after `multer` runs. `requireProductAccess` needs `projectId` to allow FREE members.
router.post('/upload', authenticateToken, upload.single('file'), requireProductAccess as any, validateFileSignature as any, checkProjectNotArchived as any, checkRole(['ADMIN', 'USER', 'PROJECT_EDIT', 'DOCUMENT_UPLOAD']) as any, uploadFile as any);
router.get('/', authenticateToken, requireProductAccess as any, getFiles);
router.get('/base64', authenticateToken, requireProductAccess as any, getFileBase64);
router.get('/project/:projectId/base64', authenticateToken, requireProductAccess as any, getProjectFilesBase64 as any);
router.get('/stats', authenticateToken, requireProductAccess as any, getDashboardStats);
router.get('/pending', authenticateToken, requireProductAccess as any, getPendingFiles);

export default router;
