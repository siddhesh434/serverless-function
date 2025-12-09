"use client";
import { useState } from "react";
import CreateFunction from "./components/CreateFunction";
import MyFunctions from "./components/MyFunctions";


export default function Home() {
  const [activeTab, setActiveTab] = useState<"create" | "functions">("functions");

  return (
    <main className="min-h-screen bg-gray-950">
      <div className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between py-4">
            <h1 className="text-xl font-bold text-white">Serverless Runner</h1>
            <div className="flex gap-1 bg-gray-900 p-1 rounded-lg">
              <button
                onClick={() => setActiveTab("functions")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === "functions"
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                My Functions
              </button>
              <button
                onClick={() => setActiveTab("create")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === "create"
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                + Create Function
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === "create" ? (
          <CreateFunction onCreated={() => setActiveTab("functions")} />
        ) : (
          <MyFunctions />
        )}
      </div>
    </main>
  );
}