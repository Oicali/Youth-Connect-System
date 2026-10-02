// frontend\src\pages\Login.jsx

import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";

import { loginSchema } from "@/lib/validations/login";
import { loginUser } from "@/lib/api/auth";
import { useErrorModal } from "@/context/ErrorModalContext";

// shared split-screen shell
import { AuthHeading } from "@/components/AuthHeading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";



export default function Login() {
  const [showPassword, setShowPassword] = useState(false);

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
      await loginUser(data);
      navigate("/dashboard");
    } catch (err) {
      if (err.type === "network" || err.type === "server") {
        showError(err.message, "Something Went Wrong");
      } else {
        setError("root", { message: err.message });
      }
    }
  };

  return (
        <>
      <AuthHeading title="Sign in" subtitle="Enter your credentials to access the system." />
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
              <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                Forgot password?
              </Link>
            </div>

            
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Signing in..." : "Sign in"}
            </Button>

            
            <p className="text-sm text-destructive text-center mb-6 min-h-[1.25rem]">
              {errors.username?.message || errors.password?.message || errors.root?.message || "\u00A0"}
            </p>
          </form>
    </>
  );
}