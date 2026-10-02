// frontend/src/pages/ForgotPassword.jsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft } from "lucide-react";

import { forgotPasswordSchema } from "@/lib/validations/forgotPassword";
import { forgotPassword } from "@/lib/api/auth";
import { useErrorModal } from "@/context/ErrorModalContext";


import { AuthHeading } from "@/components/AuthHeading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPassword() {
  const [sent, setSent] = useState(false);
  const { showError } = useErrorModal();

  const {
    register,
    handleSubmit,
    setError,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  // send the request, then switch to the "check your email" state
  const onSubmit = async ({ email }) => {
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (err) {
      if (err.type === "network" || err.type === "server") {
        showError(err.message, err.type === "network" ? "Network Error" : "Server Error");
      } else {
        setError("root", { message: err.message });
      }
    }
  };

  return (
    <>
      <AuthHeading
        title="Forgot password?"
        subtitle="Enter your email and we'll send you a reset link."
      />
      {sent ? (
        <div className="space-y-6 text-center">
          <p className="text-sm">
            If an account exists for{" "}
            <span className="font-medium">{getValues("email")}</span>, a reset link has
            been sent. Check your inbox and spam folder.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <ArrowLeft size={14} /> Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" {...register("email")} />
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Sending..." : "Send reset link"}
          </Button>

          <p className="text-sm text-destructive text-center min-h-[1.25rem]">
            {errors.email?.message || errors.root?.message || "\u00A0"}
          </p>

          <div className="text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <ArrowLeft size={14} /> Back to sign in
            </Link>
          </div>
        </form>
      )}
    </>
  );
}