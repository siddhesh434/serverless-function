"use client";
import { useState, useEffect } from "react";
import FunctionDetail from "./FunctionDetail";

interface FunctionDef {
  id: string;
  name: string;
  description: string;
  status: "draft" | "building" | "deployed" | "failed";
  createdAt: string;
  templateName?: string;
}

export default function MyFunctions() {
  const [functions, setFunctions] = useState<FunctionDef[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchFunctions = async () => {
    try {
      const res = await fetch("http://localhost:4000/functions");
      const data = await res.json();
      if (data.success) setFunctions(data.functions);
    } catch (err) {
      console.error("Failed to fetch functions:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFunctions(); }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "deployed": return "bg-green-600";
      case "building": return "bg-yellow-600";
      case "failed": return "bg-red-600";
      default: return "bg-gray-600";
    }
  };

  if (loading) {
    return <p className="text-gray-400">Loading functions...</p>;
  }

  if (selectedId) {
    return (
      <FunctionDetail
        functionId={selectedId}
        onBack={() => { setSelectedId(null); fetchFunctions(); }}
      />
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-white">My Functions</h2>
        <button onClick={fetchFunctions} className="text-sm px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-gray-300">
          Refresh
        </button>
      </div>

      {functions.length === 0 ? (
        <div className="text-center py-12 bg-gray-900 rounded-lg border border-gray-800">
          <p className="text-gray-400 mb-2">No functions yet</p>
          <p className="text-gray-500 text-sm">Create your first function to get started</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {functions.map((fn) => (
            <div
              key={fn.id}
              onClick={() => setSelectedId(fn.id)}
              className="p-4 bg-gray-900 border border-gray-800 rounded-lg cursor-pointer hover:border-gray-600 transition-colors"
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-medium text-white truncate">{fn.name}</h3>
                <span className={`px-2 py-0.5 rounded text-xs text-white ${getStatusColor(fn.status)}`}>
                  {fn.status}
                </span>
              </div>
              <p className="text-gray-400 text-sm mb-3 line-clamp-2">
                {fn.description || "No description"}
              </p>
              <p className="text-gray-500 text-xs">
                {new Date(fn.createdAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}