import { Router, Request, Response } from "express";
import { buildImage, pushImage } from "../services/docker.service";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  const { code, pixiToml, dockerUsername } = req.body;
  const tag = `${dockerUsername}/func-${Date.now()}:latest`;
  
  const logs: string[] = [];
  
  try {
    await buildImage(code, pixiToml, tag, (log) => logs.push(log));
    await pushImage(tag, (log) => logs.push(log));
    res.json({ success: true, tag, logs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message, logs });
  }
});

export default router;
