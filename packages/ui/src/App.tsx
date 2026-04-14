import { Routes, Route, NavLink } from "react-router-dom";
import Dashboard from "./pages/Dashboard.tsx";

import Files from "./pages/Files.tsx";
import Events from "./pages/Events.tsx";

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          isActive
            ? "bg-slate-700 text-white"
            : "text-slate-400 hover:text-slate-200"
        }`
      }
    >
      {label}
    </NavLink>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-slate-900">
      <header className="border-b border-slate-700 sticky top-0 z-50 bg-slate-900/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="text-blue-400">&#9632;</span> AnalyticsMap
            </h1>
            <nav className="flex gap-1">
              <NavItem to="/" label="Dashboard" />
              <NavItem to="/files" label="Files" />
              <NavItem to="/events" label="Events" />
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
<Route path="/files" element={<Files />} />
          <Route path="/files/:filePath" element={<Files />} />
          <Route path="/events" element={<Events />} />
        </Routes>
      </main>
    </div>
  );
}
