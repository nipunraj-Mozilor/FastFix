import express from 'express';
import { modifyRepo, searchAndModifyRepo } from '../controllers/repoModificationController.js';
import { aiModifyRepo } from '../controllers/aiRepoModificationController.js';
import { optimizeWebsite, applySpecificOptimization } from '../controllers/aiWebOptimizationController.js';

const router = express.Router();

// Define routes
router.post('/modify', modifyRepo);

// New route for searching and modifying across all files
router.post('/search-modify', searchAndModifyRepo);

// New AI-assisted route
router.post('/ai-modify', aiModifyRepo);

// New route for AI-powered website optimization
router.post('/ai-optimize', optimizeWebsite);

router.post('/ai-optimize-specific', applySpecificOptimization);

export default router; 