import { Router, Request, Response } from "express";
import { buildImage, pushImage, removeImage } from "../services/docker.service";
import {
  submitWorkflowFromTemplate,
  createWorkflowTemplate,
  getWorkflowStatus,
  getPodLogs,
  deleteWorkflowTemplate,
} from "../services/k8s.service";
import { storage } from "../services/storage.service";

const router = Router();

router.get("/build-function/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { dockerUsername } = req.query;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let aborted = false;
  const cleanupStack: (() => Promise<void>)[] = [];

  const fn = storage.getFunction(id);
  if (!fn) {
    res.write(`data: ${JSON.stringify({ log: "ERROR: Function not found" })}\n\n`);
    return res.end();
  }

  const tag = `${dockerUsername}/${fn.name}-${Date.now()}:latest`;
  const templateName = `${fn.name}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");

  storage.updateFunction(id, { status: "building" });
  storage.createBuild(id);

  req.on("close", async () => {
    if (!aborted) {
      aborted = true;
      storage.appendBuildLog(id, "--- Aborted by user ---");
      storage.finishBuild(id, "aborted");
      storage.updateFunction(id, { status: "failed" });
      for (const cleanup of cleanupStack.reverse()) await cleanup();
    }
  });

  const sendLog = (msg: string) => {
    if (!aborted) {
      res.write(`data: ${JSON.stringify({ log: msg })}\n\n`);
      storage.appendBuildLog(id, msg);
    }
  };

  try {
    sendLog(`Building image: ${tag}`);
    await buildImage(fn.files, fn.pixiToml, tag, sendLog, fn.envVars);
    cleanupStack.push(async () => removeImage(tag));
    if (aborted) return res.end();

    sendLog("Pushing image...");
    await pushImage(tag, sendLog);
    if (aborted) return res.end();

    sendLog("Creating WorkflowTemplate...");
    await createWorkflowTemplate(templateName, tag);
    cleanupStack.push(async () => deleteWorkflowTemplate(templateName));
    if (aborted) return res.end();

    storage.updateFunction(id, { status: "deployed", templateName, dockerImage: tag });
    storage.finishBuild(id, "success");
    sendLog(`DONE:${JSON.stringify({ templateName, tag })}`);
  } catch (err: any) {
    if (!aborted) {
      sendLog(`ERROR: ${err.message}`);
      storage.finishBuild(id, "failed");
      storage.updateFunction(id, { status: "failed" });
    }
  }
  aborted = true;
  res.end();
});

router.get("/run-function/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { args } = req.query;
  const argList = (args as string || "").split(",").map(a => a.trim()).filter(a => a);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const fn = storage.getFunction(id);
  if (!fn || !fn.templateName) {
    res.write(`data: ${JSON.stringify({ log: "ERROR: Function not deployed" })}\n\n`);
    return res.end();
  }

  const exec = storage.createExecution(id, argList.join(", "));

  const sendLog = (msg: string) => {
    res.write(`data: ${JSON.stringify({ log: msg, execId: exec.id })}\n\n`);
    storage.appendExecutionLog(exec.id, msg);
  };

  try {
    sendLog(`Running: ${fn.name}`);
    sendLog(`Arguments: ${argList.join(", ") || "(none)"}`);

    const wf: any = await submitWorkflowFromTemplate(fn.templateName, argList);
    const wfName = wf.metadata.name;
    sendLog(`Workflow: ${wfName}`);

    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const status: any = await getWorkflowStatus(wfName);
      const phase = status.status?.phase;
      sendLog(`Status: ${phase || "Pending"}`);

      if (phase === "Succeeded" || phase === "Failed") {
        const nodes = status.status?.nodes || {};
        let podName = wfName;
        for (const nodeId in nodes) {
          if (nodes[nodeId].type === "Pod") { podName = nodes[nodeId].id; break; }
        }
        const logs = await getPodLogs(podName);
        sendLog(`OUTPUT: ${logs}`);

        const resultMatch = logs.match(/\{"result":\s*(.+?)\}/);
        const errorMatch = logs.match(/\{"error":\s*"(.+?)"\}/);

        if (resultMatch) {
          storage.finishExecution(exec.id, "success", resultMatch[1]);
        } else if (errorMatch) {
          storage.finishExecution(exec.id, "failed", undefined, errorMatch[1]);
        } else {
          storage.finishExecution(exec.id, phase === "Succeeded" ? "success" : "failed");
        }
        break;
      }
    }
    sendLog("DONE");
  } catch (err: any) {
    sendLog(`ERROR: ${err.message}`);
    storage.finishExecution(exec.id, "failed", undefined, err.message);
  }
  res.end();
});


export default router;
