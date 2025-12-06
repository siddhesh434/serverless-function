import CodeForm from "./components/CodeForm";

export default function Home() {
  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Serverless Function Runner</h1>
      <CodeForm />
    </main>
  );
}
