import type { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";

export default function Layout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col pb-16">
      <main className="flex-1 p-4">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 flex border-t bg-[var(--tg-theme-bg-color)] border-[var(--tg-theme-hint-color)]/20">
        <button
          onClick={() => navigate("/")}
          className={`flex-1 py-3 text-center text-sm font-medium transition-colors ${
            location.pathname === "/"
              ? "text-[var(--tg-theme-button-color)]"
              : "text-[var(--tg-theme-hint-color)]"
          }`}
        >
          История
        </button>
        <button
          onClick={() => navigate("/stats")}
          className={`flex-1 py-3 text-center text-sm font-medium transition-colors ${
            location.pathname === "/stats"
              ? "text-[var(--tg-theme-button-color)]"
              : "text-[var(--tg-theme-hint-color)]"
          }`}
        >
          Статистика
        </button>
      </nav>
    </div>
  );
}
