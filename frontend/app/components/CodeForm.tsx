"use client";
import { useState } from "react";
import LogViewer from "./LogViewer";

const defaultPixi = `[project]
name = "func"
channels = ["conda-forge"]
platforms = ["linux-64"]

[dependencies]
python = ">=3.11"`;

export default function CodeForm() {
  const [code, setCode] = useState(`def handler(a, b):\n    return a + b`);
  const [pixiToml, setPixiToml] = useState(defaultPixi);
  const [args, setArgs] = useState("5, 3");
  const [dockerUsername, setDockerUsername] = useState("");
  const [buildLogs, setBuildLogs] = useState<string[]>([]);
  const [execLogs, setExecLogs] = useState<string[]>([]);
  const [status, setStatus] = useState("");

  const runWorkflow = (imageTag: string) => {
    const params = new URLSearchParams({ imageName: imageTag, args });
    const es = new EventSource(`http://localhost:4000/stream/run?${params}`);
    
    es.onmessage = (e) => {
      const { log } = JSON.parse(e.data);
      setExecLogs((prev) => [...prev, log]);
      if (log === "DONE") {
        setStatus("");
        es.close();
      }
    };
    es.onerror = () => es.close();
  };

  const handleDeploy = async () => {
    setBuildLogs([]);
    setExecLogs([]);
    setStatus("Building...");
    
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
      } else {
        setBuildLogs((prev) => [...prev, log]);
      }
    };
    es.onerror = () => es.close();
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
      <button onClick={handleDeploy}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
        Deploy & Run
      </button>
      {status && <p className="text-yellow-400">{status}</p>}
      <LogViewer title="Build Logs" logs={buildLogs} />
      <LogViewer title="Execution Logs" logs={execLogs} />
    </div>
  );
}
