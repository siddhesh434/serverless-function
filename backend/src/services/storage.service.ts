export interface FunctionDefinition {
  id: string;
  name: string;
  description: string;
  files: Record<string, string>; // filename -> content
  pixiToml: string;
  envVars: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  templateName?: string;
  dockerImage?: string;
  status: "draft" | "building" | "deployed" | "failed";
}

export interface BuildLog {
  functionId: string;
  logs: string[];
  status: "running" | "success" | "failed" | "aborted";
  startedAt: string;
  endedAt?: string;
}

export interface ExecutionHistory {
  id: string;
  functionId: string;
  args: string;
  result?: string;
  error?: string;
  logs: string[];
  status: "running" | "success" | "failed";
  startedAt: string;
  endedAt?: string;
}

class StorageService {
  private functions: Map<string, FunctionDefinition> = new Map();
  private builds: Map<string, BuildLog> = new Map();
  private executions: Map<string, ExecutionHistory> = new Map();

  // Functions CRUD
  createFunction(fn: Omit<FunctionDefinition, "id" | "createdAt" | "updatedAt" | "status">): FunctionDefinition {
    const id = `fn-${Date.now()}`;
    const now = new Date().toISOString();
    const func: FunctionDefinition = { ...fn, id, createdAt: now, updatedAt: now, status: "draft" };
    this.functions.set(id, func);
    return func;
  }

  getFunction(id: string): FunctionDefinition | undefined {
    return this.functions.get(id);
  }

  getAllFunctions(): FunctionDefinition[] {
    return Array.from(this.functions.values());
  }

  updateFunction(id: string, updates: Partial<FunctionDefinition>): FunctionDefinition | undefined {
    const fn = this.functions.get(id);
    if (!fn) return undefined;
    const updated = { ...fn, ...updates, updatedAt: new Date().toISOString() };
    this.functions.set(id, updated);
    return updated;
  }

  deleteFunction(id: string): boolean {
    return this.functions.delete(id);
  }

  // Build logs
  createBuild(functionId: string): BuildLog {
    const build: BuildLog = { functionId, logs: [], status: "running", startedAt: new Date().toISOString() };
    this.builds.set(functionId, build);
    return build;
  }

  appendBuildLog(functionId: string, log: string): void {
    const build = this.builds.get(functionId);
    if (build) build.logs.push(log);
  }

  finishBuild(functionId: string, status: "success" | "failed" | "aborted"): void {
    const build = this.builds.get(functionId);
    if (build) {
      build.status = status;
      build.endedAt = new Date().toISOString();
    }
  }

  getBuild(functionId: string): BuildLog | undefined {
    return this.builds.get(functionId);
  }

  // Execution history
  createExecution(functionId: string, args: string): ExecutionHistory {
    const id = `exec-${Date.now()}`;
    const exec: ExecutionHistory = { id, functionId, args, logs: [], status: "running", startedAt: new Date().toISOString() };
    this.executions.set(id, exec);
    return exec;
  }

  appendExecutionLog(execId: string, log: string): void {
    const exec = this.executions.get(execId);
    if (exec) exec.logs.push(log);
  }

  finishExecution(execId: string, status: "success" | "failed", result?: string, error?: string): void {
    const exec = this.executions.get(execId);
    if (exec) {
      exec.status = status;
      exec.result = result;
      exec.error = error;
      exec.endedAt = new Date().toISOString();
    }
  }

  getExecutionsByFunction(functionId: string): ExecutionHistory[] {
    return Array.from(this.executions.values()).filter(e => e.functionId === functionId);
  }
}

export const storage = new StorageService();