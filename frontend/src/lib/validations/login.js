// frontend/src/lib/validations/login.js

import { z } from "zod";

export const loginSchema = z.object({
  username: z
    .string()
    .min(1, "Username is required"),
  password: z
    .string()
    .min(1, "Password is required"),
  rememberMe: z.boolean().optional(),
});