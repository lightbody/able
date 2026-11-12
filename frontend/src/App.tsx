import { Route, Routes } from "react-router-dom";
import { SignOutButton } from "./auth"; // able:only auth
import { Greetings } from "./Greetings"; // able:only postgres
import { Hello } from "./Hello"; // able:only backend

export default function App() {
  return (
    <Routes>
      <Route path="/*" element={<Home />} />
    </Routes>
  );
}

// "Hello world": each feature of the app adds one line here.
function Home() {
  return (
    <main className="app">
      <header className="topbar">
        <h1>My App</h1>
        <SignOutButton /> {/* able:only auth */}
      </header>
      <p className="subtitle">A new app, ready for its first feature.</p>
      <Hello /> {/* able:only backend */}
      <Greetings /> {/* able:only postgres */}
    </main>
  );
}
