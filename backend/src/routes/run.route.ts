import { Router, Request, Response } from "express";
import { submitWorkflow } from "../services/k8s.service";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  const { imageName, args } = req.body;
  
  try {
    const workflow = await submitWorkflow(imageName, args || []);
    res.json({ success: true, workflowName: (workflow as any).metadata.name });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
