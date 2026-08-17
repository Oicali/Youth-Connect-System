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

export function Sidebar({ onNavigate, collapsed = false }) {
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
    <nav className="flex h-full flex-col py-5">
      <div className={`mb-6 flex items-center gap-2 px-4 ${collapsed ? "justify-center px-0" : ""}`}>
        <img src={theme === "dark" ? logoDark : logoLight} alt="Logo" className="h-8 w-auto shrink-0" />
        {!collapsed && (
          <span className="truncate text-sm font-bold tracking-wide text-foreground">
            YOUTH CONNECT SYSTEM
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 px-3">
        {navItems.map(({ label, path, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            onClick={onNavigate}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                collapsed ? "justify-center" : ""
              } ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-muted"
              }`
            }
          >
            <Icon size={18} className="shrink-0" />
            {!collapsed && label}
          </NavLink>
        ))}
      </div>

      <div className="border-t border-border px-3 pt-3">
        <button
          onClick={handleLogout}
          title={collapsed ? "Logout" : undefined}
          className={`mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-destructive hover:bg-muted ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <LogOut size={18} className="shrink-0" />
          {!collapsed && "Logout"}
        </button>
      </div>
    </nav>
  );
}