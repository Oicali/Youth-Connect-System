// frontend/src/components/AuthLayout.jsx
import { Outlet } from "react-router-dom";
import { Sun, Moon } from "lucide-react";

import { useTheme } from "@/context/ThemeContext";

import logoDark from "@/assets/logo-dark.png";
import logoLight from "@/assets/logo-light.png";
import formBgDark from "@/assets/form-bg-dark.avif";
import formBgLight from "@/assets/form-bg-light.avif";
import carousel1 from "@/assets/carousel-1.avif";
import carousel2 from "@/assets/carousel-2.avif";
import carousel3 from "@/assets/carousel-3.avif";
import carousel4 from "@/assets/carousel-4.avif";
import carousel5 from "@/assets/carousel-5.avif";

import { ImageCarousel } from "@/components/ImageCarousel";

const carouselImages = [carousel1, carousel2, carousel3, carousel4, carousel5];

// split-screen shell shared by auth pages (form left, carousel right)
// layout route: stays mounted while child pages swap inside <Outlet />
export function AuthLayout() {
  const { theme, toggleTheme } = useTheme();

  return (
    
    <div className="flex min-h-screen flex-row-reverse bg-background">
      {/* Left side: form */}
      <div className="relative flex w-full items-center justify-center overflow-hidden px-10 md:w-2/5">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${theme === "dark" ? formBgDark : formBgLight})`,
          }}
        />
        <div className="absolute inset-0 bg-background/85" />

        <button
          type="button"
          onClick={toggleTheme}
          className="absolute right-4 top-4 z-10 text-muted-foreground"
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <div className="relative z-10 w-full max-w-sm">
          {/* logo stays on screen across auth pages */}
          <img
            src={theme === "dark" ? logoDark : logoLight}
            alt="Logo"
            className="mx-auto -mt-12 mb-2 h-40 w-auto"
          />

          {/* current page renders here */}
          <Outlet />
        </div>
      </div>

      {/* Right side: carousel, hidden on small screens */}
      <div className="hidden md:block md:w-3/5">
        <ImageCarousel images={carouselImages} interval={5000} />
      </div>
    </div>
  );
}