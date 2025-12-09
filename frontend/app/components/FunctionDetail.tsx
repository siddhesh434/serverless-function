"use client";
import { useState, useEffect, useRef } from "react";
import LogViewer from "./LogViewer";

interface FunctionDef {
  id: string;
  name: string;
  description: string;
  files: Record<string, string>;
  pixiToml: string;
  envVars: Record<string, string>;
  status: "draft" | "building" | "deployed" | "failed";
  templateName?: string;
  dockerImage?: string;
  createdAt: string;
}

interface Execution {
  id: string;
  args: string;
  result?: string;
  error?: string;
  status: "running" | "success" | "failed";
  startedAt: string;
  endedAt?: string;
}

interface BuildLog {
  logs: string[];
  status: "running" | "success" | "failed" | "aborted";
}

interface Props {
  functionId: string;
  onBack: () => void;
}

export default function FunctionDetail({ functionId, onBack }: Props) {
  const [fn, setFn] = useState<FunctionDef | null>(null);
  const [activeFile, setActiveFile] = useState("main.py");
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [buildLog, setBuildLog] = useState<BuildLog | null>(null);
  const [buildLogs, setBuildLogs] = useState<string[]>([]);
  const [execLogs, setExecLogs] = useState<string[]>([]);
  const [testArgs, setTestArgs] = useState("");
  const [dockerUsername, setDockerUsername] = useState("siddheshwaje");
  const [loading, setLoading] = useState(false);
  const [buildStatus, setBuildStatus] = useState<string>("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const fetchFunction = async () => {
    const res = await fetch(`http://localhost:4000/functions/${functionId}`);
    const data = await res.json();
    if (data.success) setFn(data.function);
  };

  const fetchExecutions = async () => {
    const res = await fetch(`http://localhost:4000/functions/${functionId}/executions`);
    const data = await res.json();
    if (data.success) setExecutions(data.executions.reverse());
  };

  const fetchBuildLog = async () => {
    const res = await fetch(`http://localhost:4000/functions/${functionId}/build`);
    const data = await res.json();
    if (data.success && data.build) {
      setBuildLog(data.build);
      setBuildLogs(data.build.logs);
    }
  };

  useEffect(() => {
    fetchFunction();
    fetchExecutions();
    fetchBuildLog();
  }, [functionId]);

  const handleCancel = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setLoading(false);
    setBuildStatus("Cancelling...");
    setBuildLogs((prev) => [...prev, "--- Cancelled by user, rolling back ---"]);
    setTimeout(() => setBuildStatus(""), 3000);
  };

  const handleDeploy = () => {
    if (!dockerUsername) { alert("Enter DockerHub username"); return; }
    setBuildLogs([]);
    setLoading(true);
    setBuildStatus("Building...");
    setError(null);

    const es = new EventSource(
      `http://localhost:4000/stream/build-function/${functionId}?dockerUsername=${dockerUsername}`
    );
    eventSourceRef.current = es;

    es.onmessage = (e) => {
      const { log } = JSON.parse(e.data);
      setBuildLogs((prev) => [...prev, log]);

      if (log.startsWith("DONE:")) {
        setBuildStatus("Deployed successfully!");
        setLoading(false);
        es.close();
        fetchFunction();
      } else if (log.startsWith("ERROR:")) {
        setBuildStatus("");
        setError(log.replace("ERROR: ", ""));
        setLoading(false);
        es.close();
        fetchFunction();
      }
    };
    es.onerror = () => { es.close(); setLoading(false); setBuildStatus(""); };
  };

  const handleTest = () => {
    if (!fn?.templateName) { alert("Deploy the function first"); return; }
    setExecLogs([]);
    setResult(null);
    setError(null);
    setLoading(true);
    setBuildStatus("Running...");

    const params = new URLSearchParams({ args: testArgs });
    const es = new EventSource(
      `http://localhost:4000/stream/run-function/${functionId}?${params}`
    );
    eventSourceRef.current = es;

    es.onmessage = (e) => {
      const { log } = JSON.parse(e.data);
      setExecLogs((prev) => [...prev, log]);

      if (log.startsWith("OUTPUT:")) {
        const output = log.replace("OUTPUT:", "").trim();
        const resultMatch = output.match(/\{"result":\s*(.+?)\}/);
        const errorMatch = output.match(/\{"error":\s*"(.+?)"\}/);
        if (resultMatch) setResult(resultMatch[1]);
        if (errorMatch) setError(errorMatch[1]);
      }
      if (log === "DONE") {
        setBuildStatus("");
        setLoading(false);
        es.close();
        fetchExecutions();
      }
      if (log.startsWith("ERROR:")) {
        setError(log.replace("ERROR: ", ""));
        setBuildStatus("");
        setLoading(false);
        es.close();
      }
    };
    es.onerror = () => { es.close(); setLoading(false); setBuildStatus(""); };
  };

  if (!fn) return <p className="text-gray-400">Loading...</p>;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "deployed": return "bg-green-600";
      case "building": return "bg-yellow-600";
      case "failed": return "bg-red-600";
      default: return "bg-gray-600";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-gray-400 hover:text-white">← Back</button>
          <h2 className="text-xl font-bold text-white">{fn.name}</h2>
          <span className={`px-2 py-0.5 rounded text-xs text-white ${getStatusColor(fn.status)}`}>{fn.status}</span>
        </div>
        <div className="flex gap-2">
          {loading && (
            <button onClick={handleCancel} className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white text-sm">
              Cancel
            </button>
          )}
        </div>
      </div>

      {fn.description && <p className="text-gray-400">{fn.description}</p>}

      {/* Code View (Read-only) */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <div className="flex gap-2 mb-3 flex-wrap">
          {Object.keys(fn.files).map((filename) => (
            <button key={filename} onClick={() => setActiveFile(filename)}
              className={`px-3 py-1 rounded text-sm ${activeFile === filename ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-300"}`}>
              {filename}
            </button>
          ))}
          <button onClick={() => setActiveFile("pixi.toml")}
            className={`px-3 py-1 rounded text-sm ${activeFile === "pixi.toml" ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-300"}`}>
            pixi.toml
          </button>
        </div>
        <pre className="bg-black p-4 rounded overflow-x-auto text-sm text-green-400 font-mono max-h-64 overflow-y-auto">
          {activeFile === "pixi.toml" ? fn.pixiToml : fn.files[activeFile]}
        </pre>
      </div>

      {/* Environment Variables (Read-only) */}
      {Object.keys(fn.envVars).length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-2">Environment Variables</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(fn.envVars).map(([key, value]) => (
              <span key={key} className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-300">
                {key}={value ? "••••" : "(empty)"}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Deploy Section */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-300 mb-3">Deploy</h3>
        <div className="flex gap-2 items-center">
          <input value={dockerUsername} onChange={(e) => setDockerUsername(e.target.value)}
            placeholder="DockerHub username" className="p-2 bg-gray-800 border border-gray-700 rounded text-white text-sm" />
          <button onClick={handleDeploy} disabled={loading}
            className={`px-4 py-2 rounded text-white text-sm ${loading ? "bg-gray-600" : "bg-blue-600 hover:bg-blue-700"}`}>
            {fn.status === "deployed" ? "Redeploy" : "Deploy"}
          </button>
        </div>
        {fn.dockerImage && <p className="text-gray-500 text-xs mt-2">Image: {fn.dockerImage}</p>}
      </div>

      {/* Test Section */}
      {fn.status === "deployed" && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-3">Test Function</h3>
          <div className="flex gap-2 items-center mb-3">
            <input value={testArgs} onChange={(e) => setTestArgs(e.target.value)}
              placeholder="arg1, arg2, arg3" className="flex-1 p-2 bg-gray-800 border border-gray-700 rounded text-white text-sm font-mono" />
            <button onClick={handleTest} disabled={loading}
              className={`px-4 py-2 rounded text-white text-sm ${loading ? "bg-gray-600" : "bg-green-600 hover:bg-green-700"}`}>
              Run Test
            </button>
          </div>
          {result && (
            <div className="bg-green-900/50 border border-green-600 p-3 rounded mb-3">
              <span className="text-green-400 text-sm">Result: </span>
              <span className="text-white font-mono">{result}</span>
            </div>
          )}
          {error && (
            <div className="bg-red-900/50 border border-red-600 p-3 rounded mb-3">
              <span className="text-red-400 text-sm">Error: </span>
              <span className="text-white font-mono">{error}</span>
            </div>
          )}
        </div>
      )}

      {buildStatus && <p className="text-yellow-400">{buildStatus}</p>}

      {/* Logs */}
      {buildLogs.length > 0 && <LogViewer title="Build Logs" logs={buildLogs} />}
      {execLogs.length > 0 && <LogViewer title="Execution Logs" logs={execLogs} />}

      {/* Execution History */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-300 mb-3">Execution History</h3>
        {executions.length === 0 ? (
          <p className="text-gray-500 text-sm">No executions yet</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {executions.map((exec) => (
              <div key={exec.id} className="flex items-center justify-between p-2 bg-gray-800 rounded text-sm">
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${exec.status === "success" ? "bg-green-500" : exec.status === "failed" ? "bg-red-500" : "bg-yellow-500"}`} />
                  <span className="text-gray-300 font-mono">{exec.args || "(no args)"}</span>
                </div>
                <div className="flex items-center gap-3">
                  {exec.result && <span className="text-green-400 font-mono">{exec.result}</span>}
                  {exec.error && <span className="text-red-400 font-mono truncate max-w-32">{exec.error}</span>}
                  <span className="text-gray-500 text-xs">{new Date(exec.startedAt).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}