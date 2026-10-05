import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, UserPlus, Users, User, LogOut, HandHeart } from "lucide-react";
import { logoutUser } from "@/lib/api/auth";
import { useTheme } from "@/context/ThemeContext";
import logoDark from "@/assets/logo-dark.png";
import logoLight from "@/assets/logo-light.png";
[logoDark, logoLight].forEach((src) => {
  const img = new Image();
  img.src = src;
  img.decode?.().catch(() => {});
});

const navItems = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { label: "Connect", path: "/connect", icon: UserPlus },
  { label: "Care Group", path: "/caregroup", icon: HandHeart },
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
              // larger text and tap target on mobile, compact from md up
              `flex items-center gap-3 rounded-md px-3 py-2.5 text-base font-medium transition-colors md:py-2 md:text-sm ${
                collapsed ? "justify-center" : ""
              } ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-muted"
              }`
            }
          >
            {/* 20px icon on mobile, 18px from md up */}
            <Icon size={18} className="h-5 w-5 shrink-0 md:h-[18px] md:w-[18px]" />
            {!collapsed && label}
          </NavLink>
        ))}
      </div>

      <div className="border-t border-border px-3 pt-3">
        <button
          onClick={handleLogout}
          title={collapsed ? "Logout" : undefined}
          // same mobile sizing as the nav items
          className={`mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-base font-medium text-destructive hover:bg-muted md:py-2 md:text-sm ${
            collapsed ? "justify-center" : ""
          }`}
        >
          {/* matches nav icon sizing */}
          <LogOut size={18} className="h-5 w-5 shrink-0 md:h-[18px] md:w-[18px]" />
          {!collapsed && "Logout"}
        </button>
      </div>
    </nav>
  );
}