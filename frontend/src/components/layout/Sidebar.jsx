// frontend/src/components/layout/Sidebar.jsx

import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, Link2, Users, User, LogOut } from "lucide-react";
import { logoutUser } from "@/lib/api/auth";
import { useTheme } from "@/context/ThemeContext";
import logoDark from "@/assets/logo-dark.png";
import logoLight from "@/assets/logo-light.png";

const navItems = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { label: "Connect", path: "/connect", icon: Link2 },
  { label: "Users", path: "/users", icon: Users },
  { label: "Profile", path: "/profile", icon: User },
];

export function Sidebar({ onNavigate }) {
  const navigate = useNavigate();
  const { theme } = useTheme();

  const handleLogout = async () => {
    try {
      await logoutUser();
    } finally {
      navigate("/login");
      onNavigate?.();
    }
  };

  return (
    <nav className="flex h-full flex-col gap-1 py-7">
      <div className="mb-5 flex flex-col items-center text-center">
      
        <img
          src={theme === "dark" ? logoDark : logoLight}
          alt="Logo"
          className="h-35 w-auto"
        />
        <p className=" text-lg font-bold  -mt-2 text-foreground">
          Youth Engagement System
        </p>
      </div>

      {navItems.map(({ label, path, icon: Icon }) => (
        <NavLink
          key={path}
          to={path}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 px-7 py-2 text-lg font-medium transition-colors ${
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-foreground hover:bg-muted"
            }`
          }
        >
          <Icon size={18} />
          {label}
        </NavLink>
      ))}

      <button
        onClick={handleLogout}
        className="mt-auto flex items-center gap-3 px-7 py-2 text-sm font-medium text-destructive hover:bg-muted"
      >
        <LogOut size={18} />
        Logout
      </button>
    </nav>
  );
}