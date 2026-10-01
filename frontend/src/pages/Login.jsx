// frontend\src\pages\Login.jsx

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Sun, Moon } from "lucide-react";

import { loginSchema } from "@/lib/validations/login";
import { loginUser } from "@/lib/api/auth";
import { useErrorModal } from "@/context/ErrorModalContext";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

const carouselImages = [carousel1, carousel2, carousel3, carousel4, carousel5];

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { showError } = useErrorModal();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "", rememberMe: false },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  const onSubmit = async (data) => {
    try {
      const result = await loginUser(data);
      navigate("/dashboard");
    } catch (err) {
      if (err.type === "network" || err.type === "server") {
        console.log(err.type);
        showError(err.message, err.type === "network" ? "Network Error" : "Server Error");
      } else {
        setError("root", { message: err.message });
      }
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left side — form */}
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
          <div className="mb-6 flex flex-col items-center text-center -mt-12 mb-12">
            <img
              src={theme === "dark" ? logoDark : logoLight}
              alt="Logo"
              className="mx-auto mb-2 h-40 w-auto"
            />
            <h1 className="-mt-4 text-2xl font-bold">Sign in</h1>
            <p className="text-sm text-muted-foreground">
              Enter your credentials to access the system.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                autoComplete="username"
                {...register("username")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="rememberMe"
                  checked={watch("rememberMe")}
                  onCheckedChange={(checked) => setValue("rememberMe", checked)}
                />
                <Label htmlFor="rememberMe" className="text-sm font-normal">
                  Remember me
                </Label>
              </div>
              <a href="/forgot-password" className="text-sm text-primary hover:underline">
                Forgot password?
              </a>
            </div>

            
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Signing in..." : "Sign in"}
            </Button>

            
            <p className="text-sm text-destructive text-center mb-6 min-h-[1.25rem]">
              {errors.username?.message || errors.password?.message || errors.root?.message || "\u00A0"}
            </p>
          </form>
        </div>
      </div>

      {/* Right side — carousel, hidden on small screens */}
      <div className="hidden md:block md:w-3/5">
        <ImageCarousel images={carouselImages} interval={5000} />
      </div>
    </div>
  );
}