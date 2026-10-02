// frontend/src/lib/validations/forgotPassword.js
import { z } from "zod";

// validates the email on the forgot-password form
export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Enter a valid email address"),
});