// frontend\src\lib\validations\profile.js

import { z } from "zod";

export const profileSchema = z
  .object({
    first_name: z.string().min(1, "First name is required").max(50),
    last_name: z.string().min(1, "Last name is required").max(50),
    middle_name: z.string().max(50).optional().or(z.literal("")),
    suffix: z.string().max(10).optional().or(z.literal("")),
    email: z.string().min(1, "Email is required").email("Invalid email address"),
    phone: z
      .string()
      .min(1, "Phone is required")
      .regex(/^09\d{9}$/, "Phone must start with 09 and be 11 digits"),
    alt_phone: z
      .string()
      .regex(/^09\d{9}$/, "Alternate phone must start with 09 and be 11 digits")
      .optional()
      .or(z.literal("")),
    gender: z.string().min(1, "Gender is required"),
    birthdate: z.string().min(1, "Birthdate is required"),
  })
  .refine((data) => !data.alt_phone || data.alt_phone !== data.phone, {
    message: "Alternate phone must be different from phone",
    path: ["alt_phone"],
  });