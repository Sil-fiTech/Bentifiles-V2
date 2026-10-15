import { Router } from 'express';

import { disconnect, getConnection, getPickerToken, googleCallback, setFolder, startGoogleConnect } from '../controllers/storageController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.get('/google/callback', googleCallback as any);
router.get('/connection', authenticateToken as any, getConnection as any);
router.get('/google/connect', authenticateToken as any, startGoogleConnect as any);
router.get('/google/picker-token', authenticateToken as any, getPickerToken as any);
router.post('/google/folder', authenticateToken as any, setFolder as any);
router.delete('/google', authenticateToken as any, disconnect as any);

export default router;
