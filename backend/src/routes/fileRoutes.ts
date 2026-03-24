import { Router } from 'express';
import { uploadFile, getFiles, getFileBase64, getDashboardStats, getPendingFiles } from '../controllers/fileController';
import { upload } from '../middleware/upload';
import { authenticateToken } from '../middleware/auth';
import { checkRole } from '../middleware/roleMiddleware';
import { checkProjectNotArchived } from '../middleware/projectStatusMiddleware';

const router = Router();

router.post('/upload', authenticateToken, upload.single('file'), checkProjectNotArchived as any, checkRole(['ADMIN', 'USER', 'PROJECT_EDIT', 'DOCUMENT_UPLOAD']) as any, uploadFile as any);
router.get('/', authenticateToken, getFiles);
router.get('/base64', authenticateToken, getFileBase64);
router.get('/stats', authenticateToken, getDashboardStats);
router.get('/pending', authenticateToken, getPendingFiles);

export default router;
