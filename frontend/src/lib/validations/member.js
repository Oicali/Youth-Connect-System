// frontend/src/lib/validations/member.js 
import { z } from "zod";

// Fields shared by add and edit. No CHECK constraint on gender in the DB,
// so it stays a plain string here — an enum would reject legacy/mismatched data (see earlier bug).
const memberBaseSchema = z.object({
  // .trim() runs before length checks, so "  " correctly fails min(1) as "required"
  // instead of silently passing as whitespace — trimming and validation stay consistent
  first_name: z.string().trim().min(1, "First name is required").max(100),
  last_name: z.string().trim().min(1, "Last name is required").max(100),
  gender: z.string().trim().min(1, "Gender is required"),
  birth_date: z.string().optional().or(z.literal("")), // date input, no free text to trim
  added_at: z.string().optional().or(z.literal("")), // optional backdate; empty = server decides
  address: z.string().trim().optional().or(z.literal("")),
  phone_num: z.string().trim().max(30).optional().or(z.literal("")), 
  alt_phone: z.string().trim().max(30).optional().or(z.literal("")),
  main_church: z.string().trim().min(1, "Main church is required").max(255), // required in add + edit
  ministry: z.string().trim().max(255).optional().or(z.literal("")),
  facebook: z.string().trim().max(255).optional().or(z.literal("")),
  instagram: z.string().trim().max(255).optional().or(z.literal("")),
});

const withAltPhoneCheck = (schema) =>
  schema.refine((data) => !data.alt_phone || data.alt_phone !== data.phone_num, {
    message: "Alternate phone must be different from phone",
    path: ["alt_phone"],
  });

// member_status has a real CHECK constraint in the DB — enum is correct here, unlike gender.
const withStatus = (schema) =>
  schema.extend({ member_status: z.enum(["mentor", "potential mentor", "mentee", "removed"]) });

// Shared member rules (Connect + Care Group): strict 09 mobile numbers, tighter limits, name characters.
const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}\s'’.-]*$/u;
const NAME_MSG = "Letters, spaces, - ' . only";
const collapseSpaces = (s) => s.replace(/\s+/g, " ");
// empty or a full 09XXXXXXXXX; the empty case lives inside the regex so no union is needed
const mobileField = z.string().trim().regex(/^(09\d{9})?$/, "Enter all 9 digits after 09").optional();

const connectBaseSchema = memberBaseSchema.extend({
  first_name: z.string().trim().min(1, "First name is required").max(50, "Max 50 characters").regex(NAME_RE, NAME_MSG).transform(collapseSpaces),
  last_name: z.string().trim().min(1, "Last name is required").max(50, "Max 50 characters").regex(NAME_RE, NAME_MSG).transform(collapseSpaces),
  address: z.string().trim().max(255, "Max 255 characters").optional(),
  phone_num: mobileField,
  alt_phone: mobileField,
  main_church: z.string().trim().min(1, "Main church is required").max(100, "Max 100 characters"),
  ministry: z.string().trim().max(100, "Max 100 characters").optional(),
  facebook: z.string().trim().max(255, "Max 255 characters").optional(),
  instagram: z.string().trim().max(255, "Max 255 characters").optional(),
});

// alt phone needs a phone and must differ from it
const withConnectPhoneRules = (schema) =>
  schema
    .refine((d) => !d.alt_phone || !!d.phone_num, { message: "Enter a phone number first", path: ["alt_phone"] })
    .refine((d) => !d.alt_phone || d.alt_phone !== d.phone_num, { message: "Alternate phone must be different from phone", path: ["alt_phone"] });

export const addMemberSchema = withConnectPhoneRules(withStatus(connectBaseSchema)); 


export const editConnectMemberSchema = withConnectPhoneRules(connectBaseSchema);

export const editMemberSchema = withConnectPhoneRules(withStatus(connectBaseSchema)); 



export const addConnectMemberSchema = withConnectPhoneRules(connectBaseSchema);