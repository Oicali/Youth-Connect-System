import { Toaster } from "@/components/ui/sonner";
import { useTheme } from "@/context/ThemeContext";

export function AppToaster() {
  const { theme } = useTheme();

  return <Toaster richColors position="bottom-right" theme={theme} />;
}