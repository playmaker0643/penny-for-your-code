import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Click Counter" },
      { name: "description", content: "A tiny click counter — the cheapest app you'll ever ship." },
    ],
  }),
  component: Index,
});

function Index() {
  const [count, setCount] = useState(0);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-6">
      <h1 className="text-5xl font-bold tracking-tight text-foreground">
        {count}
      </h1>
      <button
        onClick={() => setCount((c) => c + 1)}
        className="rounded-full bg-primary px-8 py-3 text-sm font-medium text-primary-foreground transition-transform hover:scale-105 active:scale-95"
      >
        Click me
      </button>
      <p className="text-sm text-muted-foreground">Built for ~1 credit.</p>
    </main>
  );
}
