"use client";
import { useEffect, useRef } from "react";

interface LogViewerProps {
  title: string;
  logs: string[];
}

export default function LogViewer({ title, logs }: LogViewerProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className="mt-4">
      <h3 className="font-medium mb-2">{title}</h3>
      <div className="bg-black text-green-400 p-3 rounded h-48 overflow-y-auto font-mono text-sm">
        {logs.length === 0 ? (
          <span className="text-gray-500">Waiting for logs...</span>
        ) : (
          logs.map((log, i) => <div key={i}>{log}</div>)
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
