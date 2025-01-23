import express from 'express';
import { modifyRepo } from '../controllers/repoModificationController.js';

const router = express.Router();

// Define routes
router.post('/modify', modifyRepo);

export default router; 