import { Router } from 'express';
import { uploadFile, getFiles } from '../controllers/fileController';
import { upload } from '../middleware/upload';
import { authenticateToken } from '../middleware/auth';
import { checkRole } from '../middleware/roleMiddleware';

const router = Router();

router.post('/upload', authenticateToken, upload.single('file'), checkRole(['ADMIN', 'USER', 'PROJECT_EDIT', 'DOCUMENT_UPLOAD']), uploadFile);
router.get('/', authenticateToken, getFiles);

export default router;
