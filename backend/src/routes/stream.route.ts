import { Router, Request, Response } from "express";
import { buildImage, pushImage, removeImage } from "../services/docker.service";
import { submitWorkflow, getWorkflowStatus, getPodLogs, NAMESPACE } from "../services/k8s.service";

const router = Router();

router.get("/build", async (req: Request, res: Response) => {
  const { code, pixiToml, dockerUsername } = req.query;
  
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  
  const sendLog = (msg: string) => {
    res.write(`data: ${JSON.stringify({ log: msg })}\n\n`);
  };
  
  try {
    const tag = `${dockerUsername}/func-${Date.now()}:latest`;
    sendLog(`Building image: ${tag}`);
    await buildImage(code as string, pixiToml as string, tag, sendLog);
    sendLog("Build complete. Pushing...");
    await pushImage(tag, sendLog);
    sendLog("Cleaning up local image...");
    await removeImage(tag);
    sendLog(`DONE:${tag}`);
  } catch (err: any) {
    sendLog(`ERROR: ${err.message}`);
  }
  res.end();
});

router.get("/run", async (req: Request, res: Response) => {
  const { imageName, args } = req.query;
  const argList = (args as string || "").split(",").map(a => a.trim());
  
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  
  const sendLog = (msg: string) => {
    res.write(`data: ${JSON.stringify({ log: msg })}\n\n`);
  };
  
  try {
    sendLog("Submitting workflow...");
    const wf: any = await submitWorkflow(imageName as string, argList);
    const wfName = wf.metadata.name;
    sendLog(`Workflow: ${wfName}`);
    
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const status: any = await getWorkflowStatus(wfName);
      const phase = status.status?.phase;
      sendLog(`Status: ${phase || "Pending"}`);
      
      if (phase === "Succeeded" || phase === "Failed") {
        const podName = status.status?.nodes?.[wfName]?.id || wfName;
        const logs = await getPodLogs(podName);
        sendLog(`OUTPUT: ${logs}`);
        break;
      }
    }
    sendLog("DONE");
  } catch (err: any) {
    sendLog(`ERROR: ${err.message}`);
  }
  res.end();
});

export default router;
