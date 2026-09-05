// frontend\src\lib\validations\user.js

import { z } from "zod";

// Fields shared by profile editing, admin add-user, and admin edit-user.
const userBaseSchema = z.object({
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
});

// Every schema built on the base needs this same check — factored out so it's
// defined once instead of copy-pasted into every .refine() call.
const withAltPhoneCheck = (schema) =>
  schema.refine((data) => !data.alt_phone || data.alt_phone !== data.phone, {
    message: "Alternate phone must be different from phone",
    path: ["alt_phone"],
  });

// Self-service profile edit — just the base fields.
export const profileSchema = withAltPhoneCheck(userBaseSchema);

// Admin editing another user — base fields + role.
export const editUserSchema = withAltPhoneCheck(
  userBaseSchema.extend({
    role_id: z.string().min(1, "Required"),
  }),
);

// Admin creating a new user — base fields + role + credentials.
export const addUserSchema = withAltPhoneCheck(
  userBaseSchema.extend({
    username: z.string().min(3, "Username must be at least 3 characters"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(1, "Please confirm the password"),
    role_id: z.string().min(1, "Required"),
  }),
).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});