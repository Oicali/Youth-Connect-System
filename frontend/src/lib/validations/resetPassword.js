// frontend/src/lib/validations/resetPassword.js
import { z } from "zod";

// validates new password + confirmation on the reset form
export const resetPasswordSchema = z
  .object({
    password: z.string().min(7, "Password must be at least 7 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });