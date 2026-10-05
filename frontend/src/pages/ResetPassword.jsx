// frontend/src/pages/ResetPassword.jsx
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";

import { resetPasswordSchema } from "@/lib/validations/resetPassword";
import { resetPassword } from "@/lib/api/auth";
import { useErrorModal } from "@/context/ErrorModalContext";

import { AuthHeading } from "@/components/login/AuthHeading.jsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ResetPassword() {
  const [showPassword, setShowPassword] = useState(false);
  const [done, setDone] = useState(false);
  const [searchParams] = useSearchParams();
  const { showError } = useErrorModal();

  // token comes from the emailed link: /reset-password?token=...
  const token = searchParams.get("token");

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  // submit token + new password, show success state when accepted
  const onSubmit = async ({ password }) => {
    try {
      await resetPassword({ token, password });
      setDone(true);
    } catch (err) {
      if (err.type === "network" || err.type === "server") {
        showError(err.message, "Something Went Wrong");
      } else {
        setError("root", { message: err.message });
      }
    }
  };

  // no token in the URL: the link is broken or was opened directly
  if (!token) {
    return (
      <>
        <AuthHeading
          title="Invalid link"
          subtitle="This reset link is missing or broken."
        />
        <div className="text-center">
          <Link
            to="/forgot-password"
            className="text-sm text-primary hover:underline"
          >
            Request a new reset link
          </Link>
        </div>
      </>
    );
  }

  if (done) {
    return (
      <>
        <AuthHeading
          title="Password updated"
          subtitle="You can now sign in with your new password."
        />
        <Button asChild className="w-full">
          <Link to="/login">Go to sign in</Link>
        </Button>
      </>
    );
  }

  return (
    <>
      <AuthHeading
        title="Reset password"
        subtitle="Choose a new password for your account."
      />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
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

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            id="confirmPassword"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            {...register("confirmPassword")}
          />
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Updating..." : "Update password"}
        </Button>

        <p className="text-sm text-destructive text-center min-h-[1.25rem]">
          {errors.password?.message ||
            errors.confirmPassword?.message ||
            errors.root?.message ||
            "\u00A0"}
        </p>
        {/* escape hatch back to the login page */}
        <div className="text-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <ArrowLeft size={14} /> Back to sign in
          </Link>
        </div>
      </form>
    </>
  );
}
