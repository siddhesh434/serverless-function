"use client";
import { useState } from "react";

const defaultPixi = `[workspace]
name = "func"
channels = ["conda-forge"]
platforms = ["linux-64"]

[dependencies]
python = ">=3.11"`;

const defaultCode = `def handler(*args):
    # Your function logic here
    return sum(int(a) for a in args if str(a).isdigit())`;

interface Props {
  onCreated: () => void;
}

export default function CreateFunction({ onCreated }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<Record<string, string>>({ "main.py": defaultCode });
  const [activeFile, setActiveFile] = useState("main.py");
  const [pixiToml, setPixiToml] = useState(defaultPixi);
  const [envVars, setEnvVars] = useState<Record<string, string>>({});
  const [newEnvKey, setNewEnvKey] = useState("");
  const [newFileName, setNewFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addFile = () => {
    if (!newFileName || files[newFileName]) return;
    setFiles({ ...files, [newFileName]: "" });
    setActiveFile(newFileName);
    setNewFileName("");
  };

  const deleteFile = (filename: string) => {
    if (filename === "main.py") return;
    const { [filename]: _, ...rest } = files;
    setFiles(rest);
    setActiveFile("main.py");
  };

  const addEnvVar = () => {
    if (!newEnvKey) return;
    setEnvVars({ ...envVars, [newEnvKey]: "" });
    setNewEnvKey("");
  };

  const handleSubmit = async () => {
    if (!name.trim()) { setError("Name is required"); return; }
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("http://localhost:4000/functions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description, files, pixiToml, envVars }),
      });
      const data = await res.json();
      if (data.success) {
        onCreated();
      } else {
        setError(data.error);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Function Name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)}
            placeholder="my-function" className="w-full p-2 bg-gray-900 border border-gray-700 rounded text-white" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this function do?" className="w-full p-2 bg-gray-900 border border-gray-700 rounded text-white" />
        </div>
      </div>

      {/* File Tabs */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Files</label>
        <div className="flex gap-1 mb-2 flex-wrap">
          {Object.keys(files).map((filename) => (
            <div key={filename} className={`flex items-center gap-1 px-3 py-1 rounded text-sm ${
              activeFile === filename ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-300"
            }`}>
              <button onClick={() => setActiveFile(filename)}>{filename}</button>
              {filename !== "main.py" && (
                <button onClick={() => deleteFile(filename)} className="ml-1 text-red-400 hover:text-red-300">×</button>
              )}
            </div>
          ))}
          <div className="flex gap-1">
            <input value={newFileName} onChange={(e) => setNewFileName(e.target.value)}
              placeholder="newfile.py" className="px-2 py-1 bg-gray-900 border border-gray-700 rounded text-sm text-white w-28" />
            <button onClick={addFile} className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white">+</button>
          </div>
        </div>
        <textarea value={files[activeFile] || ""} onChange={(e) => setFiles({ ...files, [activeFile]: e.target.value })}
          className="w-full h-64 p-3 bg-gray-900 border border-gray-700 rounded font-mono text-sm text-white" />
      </div>

      {/* pixi.toml */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">pixi.toml</label>
        <textarea value={pixiToml} onChange={(e) => setPixiToml(e.target.value)}
          className="w-full h-32 p-3 bg-gray-900 border border-gray-700 rounded font-mono text-sm text-white" />
      </div>

      {/* Environment Variables */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Environment Variables</label>
        <div className="space-y-2">
          {Object.entries(envVars).map(([key, value]) => (
            <div key={key} className="flex gap-2">
              <input value={key} disabled className="w-1/3 p-2 bg-gray-800 border border-gray-700 rounded text-gray-400 text-sm" />
              <input value={value} onChange={(e) => setEnvVars({ ...envVars, [key]: e.target.value })}
                placeholder="value" className="flex-1 p-2 bg-gray-900 border border-gray-700 rounded text-white text-sm" />
              <button onClick={() => { const { [key]: _, ...rest } = envVars; setEnvVars(rest); }}
                className="px-3 py-2 bg-red-600 hover:bg-red-700 rounded text-white text-sm">×</button>
            </div>
          ))}
          <div className="flex gap-2">
            <input value={newEnvKey} onChange={(e) => setNewEnvKey(e.target.value)}
              placeholder="NEW_VAR" className="w-1/3 p-2 bg-gray-900 border border-gray-700 rounded text-white text-sm" />
            <button onClick={addEnvVar} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm">Add Variable</button>
          </div>
        </div>
      </div>

      {error && <p className="text-red-400">{error}</p>}

      <button onClick={handleSubmit} disabled={loading}
        className={`px-6 py-2 rounded font-medium ${loading ? "bg-gray-600" : "bg-blue-600 hover:bg-blue-700"} text-white`}>
        {loading ? "Creating..." : "Create Function"}
      </button>
    </div>
  );
}