// frontend/src/components/layout/Header.jsx

import { useState } from "react";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/layout/Sidebar";
import { useTheme } from "@/context/ThemeContext";
import logoDark from "@/assets/logo-dark.png";
import logoLight from "@/assets/logo-light.png";

export function Header() {
  const [open, setOpen] = useState(false);
  const { theme } = useTheme();

  return (
    <header className="flex items-center justify-between border-b border-zinc-500 dark:border-zinc-500 bg-header text-header-foreground px-4 py-3">
      
      <div className="flex items-center gap-3">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" >
              <Menu className="size-7" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 data-[side=left]:w-80 data-[side=left]:sm:max-w-80 " showCloseButton={false}>
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <Sidebar onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>

        <img
          src={theme === "dark" ? logoDark : logoLight}
          alt="Logo"
          className="h-12 w-auto -ml-1"
        />
        <h1 className="text-lg font-bold text-secondary-foreground -ml-3">Youth Engagement System</h1>
      </div>
    </header>
  );
}