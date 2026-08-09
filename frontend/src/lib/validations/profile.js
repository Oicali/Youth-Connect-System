import { z } from "zod";

export const profileSchema = z.object({
  first_name: z.string().min(1, "First name is required").max(50),
  last_name: z.string().min(1, "Last name is required").max(50),
  middle_name: z.string().max(50).optional().or(z.literal("")),
  suffix: z.string().max(10).optional().or(z.literal("")),
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  phone: z.string().min(1, "Phone is required").max(15),
  alt_phone: z.string().max(15).optional().or(z.literal("")),
  gender: z.string().min(1, "Gender is required"),
  birthdate: z.string().min(1, "Birthdate is required"),
});