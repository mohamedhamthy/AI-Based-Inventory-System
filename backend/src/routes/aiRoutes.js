import express from 'express';
import { askInventoryAssistant, getDemandForecast } from '../controllers/aiController.js';
import { authorizePermissions } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/demand', authorizePermissions('ai:use'), getDemandForecast);
router.get('/assistant', authorizePermissions('ai:use'), askInventoryAssistant);

export default router;
