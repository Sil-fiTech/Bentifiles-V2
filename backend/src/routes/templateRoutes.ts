import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
    getTemplates,
    createTemplate,
    getTemplateById,
    updateTemplate,
    deleteTemplate,
    duplicateTemplate
} from '../controllers/templateController';

const router = Router();

router.use(authenticateToken as any);

router.get('/', getTemplates);
router.post('/', createTemplate);
router.get('/:id', getTemplateById);
router.put('/:id', updateTemplate);
router.delete('/:id', deleteTemplate);
router.post('/:id/duplicate', duplicateTemplate);

export default router;
