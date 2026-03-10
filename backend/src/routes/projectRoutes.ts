import { Router } from 'express';
import { getProjects, createProject, updateProjectName, getProjectDocuments } from '../controllers/projectController';
import { createInvite, getMembers, updateMemberRole, removeMember } from '../controllers/membershipController';
import { authenticateToken } from '../middleware/auth';
import { checkRole } from '../middleware/roleMiddleware';

const router = Router();

// Require auth for all project routes
router.use(authenticateToken as any);

// Project Rules
router.get('/', getProjects as any);
router.post('/', createProject as any);
router.patch('/:id', checkRole(['ADMIN']) as any, updateProjectName as any);
router.get('/:id/documents', checkRole(['ADMIN', 'USER']) as any, getProjectDocuments as any);

// Membership Rules
router.post('/:id/invites', checkRole(['ADMIN']) as any, createInvite as any);
router.get('/:id/members', checkRole(['ADMIN', 'USER']) as any, getMembers as any);
router.patch('/:id/members/:userId', checkRole(['ADMIN']) as any, updateMemberRole as any);
router.delete('/:id/members/:userId', checkRole(['ADMIN']) as any, removeMember as any);

export default router;
