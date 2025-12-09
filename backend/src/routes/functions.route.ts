import { Router, Request, Response } from "express";
import { storage } from "../services/storage.service";

const router = Router();

// List all functions
router.get("/", (req: Request, res: Response) => {
  const functions = storage.getAllFunctions();
  res.json({ success: true, functions });
});

// Get single function
router.get("/:id", (req: Request, res: Response) => {
  const fn = storage.getFunction(req.params.id);
  if (!fn) return res.status(404).json({ success: false, error: "Not found" });
  res.json({ success: true, function: fn });
});

// Create function
router.post("/", (req: Request, res: Response) => {
  const { name, description, files, pixiToml, envVars } = req.body;
  if (!name) return res.status(400).json({ success: false, error: "Name required" });
  const fn = storage.createFunction({
    name,
    description: description || "",
    files: files || { "main.py": 'def handler(*args):\n    return "Hello"' },
    pixiToml: pixiToml || "",
    envVars: envVars || {},
  });
  res.json({ success: true, function: fn });
});

// Update function
router.put("/:id", (req: Request, res: Response) => {
  const fn = storage.updateFunction(req.params.id, req.body);
  if (!fn) return res.status(404).json({ success: false, error: "Not found" });
  res.json({ success: true, function: fn });
});

// Delete function
router.delete("/:id", (req: Request, res: Response) => {
  const deleted = storage.deleteFunction(req.params.id);
  if (!deleted) return res.status(404).json({ success: false, error: "Not found" });
  res.json({ success: true });
});

// Get build logs
router.get("/:id/build", (req: Request, res: Response) => {
  const build = storage.getBuild(req.params.id);
  res.json({ success: true, build: build || null });
});

// Get execution history
router.get("/:id/executions", (req: Request, res: Response) => {
  const executions = storage.getExecutionsByFunction(req.params.id);
  res.json({ success: true, executions });
});

export default router;