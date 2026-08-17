import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";

export default function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 flex-col overflow-y-auto border-r border-border bg-card transition-all duration-200 md:flex ${
          collapsed ? "w-20" : "w-72"
        }`}
      >
        <Sidebar collapsed={collapsed} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <Header onToggleCollapse={() => setCollapsed((c) => !c)} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}