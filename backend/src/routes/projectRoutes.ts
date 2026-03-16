import { Router } from 'express';
import { getProjects, createProject, updateProjectName, getProjectDocuments, getProjectDetails } from '../controllers/projectController';
import { createInvite, getMembers, updateMemberRole, removeMember, joinProject } from '../controllers/membershipController';
import { authenticateToken } from '../middleware/auth';
import { checkRole } from '../middleware/roleMiddleware';

const router = Router();

// Require auth for all project routes
router.use(authenticateToken as any);

// Project Rules
router.post('/join', joinProject as any);
router.get('/', getProjects as any);
router.post('/', createProject as any);
router.patch('/:id', checkRole(['ADMIN']) as any, updateProjectName as any);
router.get('/:id/documents', checkRole(['ADMIN', 'USER']) as any, getProjectDocuments as any);

import {
    getProjectRequiredDocuments,
    configureProjectRequiredDocuments,
    uploadClientDocument,
    getClientDocuments
} from '../controllers/documentController';

// Document Management (Project Level)
router.get('/:id/required-documents', checkRole(['ADMIN', 'USER']) as any, getProjectRequiredDocuments as any);
router.post('/:id/required-documents', checkRole(['ADMIN']) as any, configureProjectRequiredDocuments as any);
router.get('/:id/client-documents', checkRole(['ADMIN', 'USER']) as any, getClientDocuments as any);
router.post('/:id/client-documents', checkRole(['ADMIN', 'USER']) as any, uploadClientDocument as any);

// Membership Rules
router.post('/:id/invites', checkRole(['ADMIN']) as any, createInvite as any);
router.get('/:id/members', checkRole(['ADMIN', 'USER']) as any, getMembers as any);
router.patch('/:id/members/:userId', checkRole(['ADMIN']) as any, updateMemberRole as any);
router.delete('/:id/members/:userId', checkRole(['ADMIN']) as any, removeMember as any);

router.get('/:id/details', checkRole(['ADMIN', 'USER']) as any, getProjectDetails as any);

export default router;
