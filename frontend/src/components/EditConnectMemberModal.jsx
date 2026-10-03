//frontend\src\components\EditConnectMemberModal.jsx

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { editConnectMemberSchema } from "@/lib/validations/member";
import { updateMember, assignConnector, unassignConnector, fetchMembers, fetchDuplicateMembers } from "@/lib/api/members";
import { AlertTriangle, Pencil, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getDuplicateStatusLabel } from "@/lib/memberStatusLabels";
import { useErrorModal } from "@/context/ErrorModalContext";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

const GENDER_LABELS_FORM = { male: "Male", female: "Female" };

// allowed hosts per platform; subdomains (m., web., www.) are matched in toSocialUrl
const FACEBOOK_HOSTS = ["facebook.com", "fb.com", "fb.me"];
const INSTAGRAM_HOSTS = ["instagram.com", "instagr.am"];

// turns a pasted link into a safe URL, or null unless it is http(s), on an allowed host, and has a path (not just the homepage)
const toSocialUrl = (raw, hosts) => {
  const value = (raw || "").trim();
  if (!value || /\s/.test(value)) return null;
  const candidate = /^https?:\/\//i.test(value)
    ? value
    : /^(www\.|[\w-]+\.[a-z]{2,}\/)/i.test(value) ? `https://${value}` : null; // allows "facebook.com/name" without the protocol
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const host = url.hostname.toLowerCase();
    const onAllowedHost = hosts.some((h) => host === h || host.endsWith(`.${h}`)); // "." prefix blocks lookalikes like evilfacebook.com
    return onAllowedHost && url.pathname.length > 1 ? url.href : null;
  } catch {
    return null;
  }
};

// bordered icon button that sits inside an input: real link when valid, dimmed and unclickable when not
const ProfileLinkButton = ({ url, label }) => {
  const base = "absolute right-1 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md border border-input";
  return url ? (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open ${label} profile`}
      className={`${base} text-muted-foreground hover:border-primary hover:text-primary`}
    >
      <ExternalLink size={14} />
    </a>
  ) : (
    <span aria-disabled="true" className={`${base} cursor-not-allowed text-muted-foreground opacity-40`}>
      <ExternalLink size={14} />
    </span>
  );
};

const buildDefaults = (member) => ({
  first_name: member?.first_name || "",
  last_name: member?.last_name || "",
  gender: member?.gender || "",
  birth_date: member?.birth_date ? String(member.birth_date).slice(0, 10) : "",
  address: member?.address || "",
  phone_num: member?.phone_num || "",
  alt_phone: member?.alt_phone || "",
  main_church: member?.main_church || "",
  ministry: member?.ministry || "",
  facebook: member?.facebook || "",
  instagram: member?.instagram || "",
  added_at: member?.added_at ? String(member.added_at).slice(0, 10) : "", // prefill so saving doesn't change it
});

export function EditConnectMemberModal({ member, open, onOpenChange, onSaved }) {
  const { showError } = useErrorModal();
  // today in PH time as YYYY-MM-DD, used as the max for the date input
  const phToday = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  const {
    register, handleSubmit, reset, setValue, watch,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(editConnectMemberSchema), defaultValues: buildDefaults(null) });

  // connector lives outside react-hook-form — it's saved via assignConnector/
  // unassignConnector, a different endpoint than PUT /members/:id
  const [connectorId, setConnectorId] = useState("");
  const [mentorOptions, setMentorOptions] = useState([]);
  const [mentorsLoading, setMentorsLoading] = useState(false);
  const [duplicateMatches, setDuplicateMatches] = useState([]); // warning only, never blocks saving
  const originalConnectorId = member?.assigned_to ? String(member.assigned_to) : "";
  const originalConnectorLabel = member?.connector_first_name
    ? `${member.connector_first_name} ${member.connector_last_name}`
    : "";

  useEffect(() => {
    if (open && member) {
      reset(buildDefaults(member));
      setConnectorId(originalConnectorId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, member, reset]);

  // fetch mentors for the current gender — mirrors AddConnectMemberModal, but the
  // currently-assigned connector may not be in this list (gender changed since
  // assignment, or they were assigned before the mentor-only rule existed);
  // originalConnectorLabel below covers that display case
  const genderValue = watch("gender");
  // clickable profile links, null while the field isn't a recognizable link
  const facebookUrl = toSocialUrl(watch("facebook"), FACEBOOK_HOSTS);
  const instagramUrl = toSocialUrl(watch("instagram"), INSTAGRAM_HOSTS);
  useEffect(() => {
    if (!open || !genderValue) { setMentorOptions([]); return; }
    let cancelled = false;
    setMentorsLoading(true);
    fetchMembers({ role: ["mentor"], gender: genderValue, limit: 50 })
      .then(({ members }) => { if (!cancelled) setMentorOptions(members); })
      .catch(() => { if (!cancelled) setMentorOptions([]); })
      .finally(() => { if (!cancelled) setMentorsLoading(false); });
    return () => { cancelled = true; };
  }, [open, genderValue]);

  // debounced name check, only when the name differs from the saved one; excludes this member's own row
  const firstNameValue = watch("first_name");
  const lastNameValue = watch("last_name");
  useEffect(() => {
    if (!open || !member) { setDuplicateMatches([]); return; }
    const first = (firstNameValue || "").trim();
    const last = (lastNameValue || "").trim();
    const unchanged =
      first.toLowerCase() === (member.first_name || "").trim().toLowerCase() &&
      last.toLowerCase() === (member.last_name || "").trim().toLowerCase();
    if (unchanged || (first + last).length < 2) { setDuplicateMatches([]); return; }

    let cancelled = false;
    const timer = setTimeout(() => {
      fetchDuplicateMembers(first, last, { excludeId: member.id })
        .then(({ members }) => { if (!cancelled) setDuplicateMatches(members); })
        .catch(() => { if (!cancelled) setDuplicateMatches([]); });
    }, 400);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [open, member, firstNameValue, lastNameValue]);

  // removed members have no active pipeline state — connector editing doesn't apply
  const isRemoved = member?.connection_status === "removed";

  const onSubmit = async (data) => {
    try {
      await updateMember(member.id, data);

      if (!isRemoved && connectorId !== originalConnectorId) {
        if (connectorId) {
          await assignConnector(member.id, connectorId);
        } else {
          await unassignConnector(member.id);
        }
      }

      toast.success("Member updated");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      showError(err.message, "Could Not Update Member");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* p-0 + flex-col: header and footer are pinned bars, only the form body scrolls */}
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[820px]">
                <DialogHeader className="border-b border-border px-5 py-5">
          <div className="flex items-start gap-4">
            {/* icon badge: primary-tinted circle, same icon and tint as the Edit button in the table */}
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Pencil size={18} className="text-primary" />
            </div>
            <div className="space-y-1.5 text-left">
              <DialogTitle>Edit First-Timer</DialogTitle>
              <DialogDescription>
                Update details and follow-up. <span className="text-destructive">*</span> required
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col" noValidate>
          {/* scrollable body: 1 column on mobile, 3 columns on sm+ */}
          <div className="grid flex-1 grid-cols-1 content-start gap-4 overflow-y-auto px-7 py-5 sm:grid-cols-3">
            {/* warning only: editing an existing record, so no lock and no override checkbox */}
            {duplicateMatches.length > 0 && (
              <div className="space-y-2 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3 sm:col-span-3">
                <div className="flex items-center gap-2 text-sm font-medium text-yellow-600">
                  <AlertTriangle size={16} />
                  Another member has a similar name:
                </div>
                <ul className="space-y-1.5">
                  {duplicateMatches.map((match) => {
                    const { label, tone } = getDuplicateStatusLabel(match);
                    return (
                      <li key={match.id} className="flex items-center gap-2 text-sm">
                        • {match.first_name} {match.last_name}
                        <Badge variant="secondary" className={tone === "destructive" ? "text-destructive" : "text-muted-foreground"}>
                          {label}
                        </Badge>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* section: Personal */}
            <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground after:h-px after:flex-1 after:bg-border after:content-[''] sm:col-span-3">
              Personal
            </div>
            <div className="space-y-2">
              <Label>First name <span className="text-destructive">*</span></Label>
              <Input {...register("first_name")} />
              {errors.first_name && <p className="text-sm text-destructive">{errors.first_name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Last name <span className="text-destructive">*</span></Label>
              <Input {...register("last_name")} />
              {errors.last_name && <p className="text-sm text-destructive">{errors.last_name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Gender <span className="text-destructive">*</span></Label>
              <Select value={watch("gender")} onValueChange={(v) => setValue("gender", v, { shouldValidate: true })}>
                <SelectTrigger className="w-full"> {/* fill the grid cell like the inputs */}
                  <SelectValue placeholder="Select gender">{GENDER_LABELS_FORM[watch("gender")]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
              {errors.gender && <p className="text-sm text-destructive">{errors.gender.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Birth date</Label>
              <Input type="date" {...register("birth_date")} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Address</Label>
              <Input {...register("address")} />
            </div>

            {/* section: Contact */}
            <div className="mt-2 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground after:h-px after:flex-1 after:bg-border after:content-[''] sm:col-span-3">
              Contact
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input placeholder="09XX XXX XXXX" {...register("phone_num")} />
              {errors.phone_num && <p className="text-sm text-destructive">{errors.phone_num.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Alt phone</Label>
              <Input {...register("alt_phone")} />
              {errors.alt_phone && <p className="text-sm text-destructive">{errors.alt_phone.message}</p>}
            </div>
            {/* sm:col-start-1 starts a new row, leaving the 3rd cell of the phone row empty */}
            <div className="space-y-2 sm:col-start-1">
              <Label>Facebook</Label>
              <div className="relative">
                <Input className="pr-10" placeholder="Paste profile link" {...register("facebook")} />
                {/* open-in-new-tab button, clickable only for a valid Facebook link */}
                <ProfileLinkButton url={facebookUrl} label="Facebook" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Instagram</Label>
              <div className="relative">
                <Input className="pr-10" placeholder="Paste profile link" {...register("instagram")} />
                {/* open-in-new-tab button, clickable only for a valid Instagram link */}
                <ProfileLinkButton url={instagramUrl} label="Instagram" />
              </div>
            </div>

            {/* section: Church & follow-up */}
            <div className="mt-2 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground after:h-px after:flex-1 after:bg-border after:content-[''] sm:col-span-3">
              Church &amp; follow-up
            </div>
            <div className="space-y-2">
              <Label>Main church</Label>
              <Input {...register("main_church")} />
            </div>
            <div className="space-y-2">
              <Label>Ministry</Label>
              <Input {...register("ministry")} />
            </div>
            {/* prefilled with the existing date; empty keeps it unchanged server-side */}
            <div className="space-y-2">
              <Label>Date added</Label>
              <Input type="date" max={phToday} {...register("added_at")} />
              {errors.added_at && <p className="text-sm text-destructive">{errors.added_at.message}</p>}
            </div>
            {/* 1 column only; hidden for removed members (no active pipeline) */}
            {!isRemoved && (
              <div className="space-y-2">
                <Label>Assign to (optional)</Label>
                <Select value={connectorId} onValueChange={setConnectorId} disabled={!genderValue}>
                  <SelectTrigger className="w-full"> {/* fill the grid cell like the inputs */}
                    <SelectValue placeholder={genderValue ? "Select a mentor" : "Select a gender first"}>
                      {connectorId
                        ? mentorOptions.find((m) => String(m.id) === connectorId)
                          ? `${mentorOptions.find((m) => String(m.id) === connectorId).first_name} ${mentorOptions.find((m) => String(m.id) === connectorId).last_name}`
                          // fallback: connector exists but isn't in the current gender-filtered mentor list
                          : (connectorId === originalConnectorId ? originalConnectorLabel : undefined)
                        : "None"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {mentorsLoading && <SelectItem value="__loading" disabled>Loading...</SelectItem>}
                    {connectorId === originalConnectorId && originalConnectorId &&
                      !mentorOptions.some((m) => String(m.id) === originalConnectorId) && (
                        <SelectItem value={originalConnectorId}>{originalConnectorLabel} (current)</SelectItem>
                    )}
                    {mentorOptions.map((mentorOpt) => (
                      <SelectItem key={mentorOpt.id} value={String(mentorOpt.id)}>
                        {mentorOpt.first_name} {mentorOpt.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* pinned footer bar, outside the scrolling body */}
          <DialogFooter className="border-t bg-muted/30 px-7 py-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Save changes"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}