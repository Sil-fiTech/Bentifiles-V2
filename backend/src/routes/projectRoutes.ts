import { Router } from 'express';
import { getProjects, createProject, updateProjectName, getProjectDocuments, getProjectDetails, applyTemplateToProject, archiveProject, unarchiveProject, deleteProject } from '../controllers/projectController';
import { createInvite, getMembers, updateMemberRole, removeMember, joinProject } from '../controllers/membershipController';
import { authenticateToken } from '../middleware/auth';
import { checkRole } from '../middleware/roleMiddleware';
import { checkProjectNotArchived } from '../middleware/projectStatusMiddleware';

const router = Router();

// Require auth for all project routes
router.use(authenticateToken as any);

// Project Rules
router.post('/join', joinProject as any);
router.get('/', getProjects as any);
router.post('/', createProject as any);
router.patch('/:id', checkRole(['ADMIN']) as any, checkProjectNotArchived as any, updateProjectName as any);
router.delete('/:id', checkRole(['ADMIN']) as any, deleteProject as any);
router.patch('/:id/archive', checkRole(['ADMIN']) as any, archiveProject as any);
router.patch('/:id/unarchive', checkRole(['ADMIN']) as any, unarchiveProject as any);
router.get('/:id/documents', checkRole(['ADMIN', 'USER']) as any, getProjectDocuments as any);
router.post('/:id/apply-template', checkRole(['ADMIN']) as any, checkProjectNotArchived as any, applyTemplateToProject as any);

import {
    getProjectRequiredDocuments,
    configureProjectRequiredDocuments,
    uploadClientDocument,
    getClientDocuments
} from '../controllers/documentController';

// Document Management (Project Level)
router.get('/:id/required-documents', checkRole(['ADMIN', 'USER']) as any, getProjectRequiredDocuments as any);
router.post('/:id/required-documents', checkRole(['ADMIN']) as any, checkProjectNotArchived as any, configureProjectRequiredDocuments as any);
router.get('/:id/client-documents', checkRole(['ADMIN', 'USER']) as any, getClientDocuments as any);
router.post('/:id/client-documents', checkRole(['ADMIN', 'USER']) as any, checkProjectNotArchived as any, uploadClientDocument as any);

// Membership Rules
router.post('/:id/invites', checkRole(['ADMIN']) as any, checkProjectNotArchived as any, createInvite as any);
router.get('/:id/members', checkRole(['ADMIN', 'USER']) as any, getMembers as any);
router.patch('/:id/members/:userId', checkRole(['ADMIN']) as any, checkProjectNotArchived as any, updateMemberRole as any);
router.delete('/:id/members/:userId', checkRole(['ADMIN']) as any, checkProjectNotArchived as any, removeMember as any);

router.get('/:id/details', checkRole(['ADMIN', 'USER']) as any, getProjectDetails as any);

export default router;
