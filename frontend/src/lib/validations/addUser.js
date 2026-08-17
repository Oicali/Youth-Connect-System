import { z } from "zod";

export const addUserSchema = z
  .object({
    username: z.string().min(3, "Username must be at least 3 characters"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(1, "Please confirm the password"),
    first_name: z.string().min(1, "Required"),
    last_name: z.string().min(1, "Required"),
    middle_name: z.string().optional().or(z.literal("")),
    suffix: z.string().optional().or(z.literal("")),
    email: z.string().email("Invalid email"),
    phone: z.string().min(1, "Required"),
    alt_phone: z.string().optional().or(z.literal("")),
    gender: z.string().min(1, "Required"),
    birthdate: z.string().min(1, "Required"),
    role_id: z.string().min(1, "Required"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((data) => !data.alt_phone || data.alt_phone !== data.phone, {
    message: "Alternate phone must be different from phone",
    path: ["alt_phone"],
  });