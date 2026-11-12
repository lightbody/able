import { Route, Routes } from "react-router-dom";
import { SignOutButton } from "./auth"; // able:only auth
import { Greetings } from "./Greetings"; // able:only postgres

export default function App() {
  return (
    <Routes>
      <Route path="/*" element={<Home />} />
    </Routes>
  );
}

function Home() {
  return (
    <main className="app">
      <header className="topbar">
        <h1>My App</h1>
        <SignOutButton /> {/* able:only auth */}
      </header>
      <p className="subtitle">Skeleton project -- Postgres → Neon Realtime → React, end to end.</p> {/* able:only postgres */}

      <Greetings /> {/* able:only postgres */}
    </main>
  );
}
