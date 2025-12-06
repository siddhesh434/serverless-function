"use client";
import { useState } from "react";
import LogViewer from "./LogViewer";

const defaultPixi = `[workspace]
name = "func"
channels = ["conda-forge"]
platforms = ["linux-64"]

[dependencies]
python = ">=3.11"`;

export default function CodeForm() {
  const [code, setCode] = useState(`def handler(a, b):\n    return a + b`);
  const [pixiToml, setPixiToml] = useState(defaultPixi);
  const [args, setArgs] = useState("5, 3");
  const [dockerUsername, setDockerUsername] = useState("siddheshwaje");
  const [buildLogs, setBuildLogs] = useState<string[]>([]);
  const [execLogs, setExecLogs] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clearAll = () => {
    setBuildLogs([]);
    setExecLogs([]);
    setResult(null);
    setError(null);
    setStatus("");
  };

  const runWorkflow = (imageTag: string) => {
    const params = new URLSearchParams({ imageName: imageTag, args });
    const es = new EventSource(`http://localhost:4000/stream/run?${params}`);
    
    es.onmessage = (e) => {
      const { log } = JSON.parse(e.data);
      setExecLogs((prev) => [...prev, log]);
      
      if (log.startsWith("OUTPUT:")) {
        const resultMatch = log.match(/\{"result":\s*(.+?)\}/);
        const errorMatch = log.match(/\{"error":\s*"(.+?)"\}/);
        if (resultMatch) setResult(resultMatch[1]);
        if (errorMatch) setError(errorMatch[1]);
      }
      if (log === "DONE") {
        setStatus("");
        setLoading(false);
        es.close();
      }
    };
    es.onerror = () => { es.close(); setLoading(false); };
  };

  const handleDeploy = async () => {
    if (!dockerUsername) { alert("Enter DockerHub username"); return; }
    setBuildLogs([]);
    setExecLogs([]);
    setStatus("Building...");
    setLoading(true);
    setResult(null);
    setError(null);
    
    const params = new URLSearchParams({ code, pixiToml, dockerUsername });
    const es = new EventSource(`http://localhost:4000/stream/build?${params}`);
    
    es.onmessage = (e) => {
      const { log } = JSON.parse(e.data);
      if (log.startsWith("DONE:")) {
        const tag = log.replace("DONE:", "");
        setBuildLogs((prev) => [...prev, `Image ready: ${tag}`]);
        setStatus("Running workflow...");
        es.close();
        runWorkflow(tag);
      } else if (log.startsWith("ERROR:")) {
        setBuildLogs((prev) => [...prev, log]);
        setLoading(false);
        setStatus("");
        setError(log.replace("ERROR: ", ""));
        es.close();
      } else {
        setBuildLogs((prev) => [...prev, log]);
      }
    };
    es.onerror = () => { es.close(); setLoading(false); };
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block font-medium mb-1">Python Code</label>
        <textarea value={code} onChange={(e) => setCode(e.target.value)}
          className="w-full h-40 p-2 border rounded font-mono text-sm bg-gray-900" />
      </div>
      <div>
        <label className="block font-medium mb-1">pixi.toml</label>
        <textarea value={pixiToml} onChange={(e) => setPixiToml(e.target.value)}
          className="w-full h-32 p-2 border rounded font-mono text-sm bg-gray-900" />
      </div>
      <div>
        <label className="block font-medium mb-1">Arguments (comma-separated)</label>
        <input value={args} onChange={(e) => setArgs(e.target.value)}
          className="w-full p-2 border rounded font-mono text-sm bg-gray-900" />
      </div>
      <div>
        <label className="block font-medium mb-1">DockerHub Username</label>
        <input value={dockerUsername} onChange={(e) => setDockerUsername(e.target.value)}
          className="w-full p-2 border rounded font-mono text-sm bg-gray-900" />
      </div>
      <div className="flex gap-2">
        <button onClick={handleDeploy} disabled={loading}
          className={`px-4 py-2 rounded text-white ${loading ? "bg-gray-500" : "bg-blue-600 hover:bg-blue-700"}`}>
          {loading ? "Running..." : "Deploy & Run"}
        </button>
        <button onClick={clearAll} disabled={loading}
          className="px-4 py-2 rounded text-white bg-gray-600 hover:bg-gray-700">
          Clear
        </button>
      </div>
      {status && <p className="text-yellow-400">{status}</p>}
      {result && (
        <div className="bg-green-900 border border-green-500 p-4 rounded">
          <span className="text-green-300 font-medium">Result: </span>
          <span className="text-white font-mono text-lg">{result}</span>
        </div>
      )}
      {error && (
        <div className="bg-red-900 border border-red-500 p-4 rounded">
          <span className="text-red-300 font-medium">Error: </span>
          <span className="text-white font-mono">{error}</span>
        </div>
      )}
      <LogViewer title="Build Logs" logs={buildLogs} />
      <LogViewer title="Execution Logs" logs={execLogs} />
    </div>
  );
}
