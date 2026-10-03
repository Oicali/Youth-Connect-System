// frontend/src/lib/validations/member.js 
import { z } from "zod";

// Fields shared by add and edit. No CHECK constraint on gender in the DB,
// so it stays a plain string here — an enum would reject legacy/mismatched data (see earlier bug).
const memberBaseSchema = z.object({
  // .trim() runs before length checks, so "  " correctly fails min(1) as "required"
  // instead of silently passing as whitespace — trimming and validation stay consistent
  first_name: z.string().trim().min(1, "First name is required").max(100),
  last_name: z.string().trim().min(1, "Last name is required").max(100),
  gender: z.string().trim().optional().or(z.literal("")),
  birth_date: z.string().optional().or(z.literal("")), // date input, no free text to trim
  added_at: z.string().optional().or(z.literal("")), // optional backdate; empty = server decides
  address: z.string().trim().optional().or(z.literal("")),
  phone_num: z.string().trim().max(30).optional().or(z.literal("")), 
  alt_phone: z.string().trim().max(30).optional().or(z.literal("")),
  main_church: z.string().trim().max(255).optional().or(z.literal("")),
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

export const addMemberSchema = withAltPhoneCheck(withStatus(memberBaseSchema));

// Same shape as add — edit modal only touches base fields. connection_status and
// the connector (assigned_to) are managed separately: connector via ConnectorPicker
// inside the modal (assignConnector/unassignConnector), connection_status via the
// table's status actions (join care group / mark removed) — never via PUT /members/:id.
export const editConnectMemberSchema = withAltPhoneCheck(memberBaseSchema);


// Same shape as add for now. member_status stays in this schema because the Status field
// lives in the same form — it's saved through PATCH /:id/status separately, not PUT /:id.
export const editMemberSchema = withAltPhoneCheck(withStatus(memberBaseSchema));

// Connect first-timer intake — same fields as add/edit, no member_status select
// (locked server-side to the default "mentee"; connection_status starts at "pending").
// gender is required here (unlike memberBaseSchema) because JoinCareGroupModal filters
// mentors by gender — a first-timer with no gender on file can't be moved into a care
// group without the Connect team picking gender first, so we force it at intake instead.
const connectMemberSchema = memberBaseSchema.extend({
  gender: z.string().trim().min(1, "Gender is required"),
});

export const addConnectMemberSchema = withAltPhoneCheck(connectMemberSchema);