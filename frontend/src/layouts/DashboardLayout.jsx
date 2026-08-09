// frontend/src/components/layouts/DashboardLayout.jsx
import { Outlet } from "react-router-dom";
import { Header } from "@/components/layout/Header";

export default function DashboardLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}