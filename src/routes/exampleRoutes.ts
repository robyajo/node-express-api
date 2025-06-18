import { Router } from 'express';
import { getAllExamples, createExample } from '../controllers/exampleController';

const router = Router();

router.get('/examples', getAllExamples);
router.post('/examples', createExample);

export default router;