import express from 'express';
import { body } from 'express-validator';
import { createWorkspace, getWorkspaces } from '../controllers/workspaceController.js';
import { protect } from '../middleware/authMiddleware.js';
import { preventDemoWrites, verifyCsrfToken } from '../middleware/demoAccessMiddleware.js';
import { validate } from '../validators/validation.js';

const router = express.Router();

router.use(protect, verifyCsrfToken, preventDemoWrites);
router.get('/', getWorkspaces);
router.post('/', body('name').isString().trim().isLength({ min: 2, max: 60 }).withMessage('Workspace name must be between 2 and 60 characters'), validate, createWorkspace);

export default router;
