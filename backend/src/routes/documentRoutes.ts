import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
    getDocumentTypes,
    createDocumentType,
    updateDocumentType,
    deleteDocumentType,
    updateClientDocumentStatus
} from '../controllers/documentController';
import { requireProductAccess } from '../middleware/requireProductAccess';
import { checkRole } from '../middleware/roleMiddleware';

const router = Router();

// Require auth for all
router.use(authenticateToken as any);
router.use(requireProductAccess as any);

// Global Document Types
router.get('/types', getDocumentTypes as any);
router.post('/types', createDocumentType as any);
router.put('/types/:id', updateDocumentType as any);
router.delete('/types/:id', deleteDocumentType as any);

// Document specific actions (Requires projectId from the document to check role if we want, 
// but updateClientDocumentStatus currently expects `req.projectRole` which is set by `checkRole`.
// `checkRole` requires `projectId` in params/body/query. We must pass projectId in the body.
router.patch('/:docId/status', checkRole(['ADMIN']) as any, updateClientDocumentStatus as any);

export default router;
