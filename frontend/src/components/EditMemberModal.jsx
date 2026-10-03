// frontend/src/components/EditMemberModal.jsx
import { useEffect, useState, useMemo } from "react";
import { AlertTriangle, Pencil, ExternalLink, Calendar as CalendarIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { format, parse } from "date-fns";

import { editMemberSchema } from "@/lib/validations/member";
import {
  updateMember, setMemberStatus, assignMentor, unassignMentor, fetchMembers, fetchDuplicateMembers,
} from "@/lib/api/members";
import { useErrorModal } from "@/context/ErrorModalContext";
import { getDuplicateStatusLabel } from "@/lib/memberStatusLabels";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

const STATUS_LABELS = {
  mentor: "Mentor",
  "potential mentor": "Potential Mentor",
  mentee: "Mentee",
};
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
  const base = "absolute right-1 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md";
  return url ? (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open ${label} profile`}
      className={`${base} text-muted-foreground hover:text-primary`}
    >
      <ExternalLink size={14} />
    </a>
  ) : (
    <span aria-disabled="true" className={`${base} cursor-not-allowed text-muted-foreground opacity-40`}>
      <ExternalLink size={14} />
    </span>
  );
};

function toFormValues(member) {
  return {
    member_status: member?.member_status || "mentee",
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
  };
}

export function EditMemberModal({ member, open, onOpenChange, onSaved, allowMentorAssignment = false }) {
  const { showError } = useErrorModal();
  const [birthOpen, setBirthOpen] = useState(false); // birth date popover

  const [selectedMentorId, setSelectedMentorId] = useState("");
  const [mentorOptions, setMentorOptions] = useState([]);
  const [mentorsLoading, setMentorsLoading] = useState(false);

  const {
    register, handleSubmit, reset, setError, setValue, watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(editMemberSchema),
    defaultValues: toFormValues(member),
  });

  const [saving, setSaving] = useState(false);
  const [pendingValues, setPendingValues] = useState(null);   // form values held while the demote warning is up
  const [showDemoteWarning, setShowDemoteWarning] = useState(false);
  const [duplicateMatches, setDuplicateMatches] = useState([]); // warning only, never blocks saving

  useEffect(() => {
    if (!open) return;
    reset(toFormValues(member));
    setSelectedMentorId(member?.mentor_id ? String(member.mentor_id) : "");
  }, [member, open, reset]);

  // gender drives the mentor list — refetch on any live change, not just the member's saved gender
  const genderValue = watch("gender");
  // clickable profile links, null while the field isn't a recognizable link
  const facebookUrl = toSocialUrl(watch("facebook"), FACEBOOK_HOSTS);
  const instagramUrl = toSocialUrl(watch("instagram"), INSTAGRAM_HOSTS);

  const selectedMentorLabel = useMemo(() => {
    if (!selectedMentorId) return "None";
    const found = mentorOptions.find((m) => String(m.id) === selectedMentorId);
    if (found) return `${found.first_name} ${found.last_name}`;
    // options haven't loaded/matched yet — fall back to the name already on the row
    // (mentor_first_name/mentor_last_name come from the LEFT JOIN in memberRepository)
    if (member?.mentor_id && String(member.mentor_id) === selectedMentorId) {
      return member.mentor_first_name ? `${member.mentor_first_name} ${member.mentor_last_name}` : undefined;
    }
    return undefined;
  }, [selectedMentorId, mentorOptions, member]);

  useEffect(() => {
    if (!open || !allowMentorAssignment || !genderValue) {
      setMentorOptions([]);
      return;
    }
    let cancelled = false;
    setMentorsLoading(true);
    fetchMembers({ role: ["mentor"], gender: genderValue, limit: 100 })
      // exclude the member being edited — on the Mentors tab the person being edited IS a mentor
      .then(({ members }) => { if (!cancelled) setMentorOptions(members.filter((m) => m.id !== member?.id)); })
      .catch(() => { if (!cancelled) setMentorOptions([]); })
      .finally(() => { if (!cancelled) setMentorsLoading(false); });
    return () => { cancelled = true; };
  }, [open, allowMentorAssignment, genderValue]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const doSubmit = async (values, { cascadeUnassignMentees = false } = {}) => {
    const { member_status, ...profileFields } = values;
    const statusChanged = member_status !== member?.member_status;
    const currentMentorId = member?.mentor_id ? String(member.mentor_id) : "";
    const mentorChanged = allowMentorAssignment && selectedMentorId !== currentMentorId;

    setSaving(true);

    // tracks which step actually failed so the error message reflects real DB state,
    // not just "something went wrong" — profile/status can succeed while mentor assignment fails
    let step = "profile";
    try {
      await updateMember(member.id, profileFields);

      // separate endpoints by design — PUT /:id ignores member_status and mentor_id server-side
      if (statusChanged) {
        step = "status";
        await setMemberStatus(member.id, member_status, { cascadeUnassignMentees });
      }
      if (mentorChanged) {
        step = "mentor";
        if (selectedMentorId) await assignMentor(member.id, selectedMentorId);
        else await unassignMentor(member.id);
      }

      toast.success("Member updated");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      if (err.field) {
        setError(err.field, { type: "server", message: err.message });
      } else if (step === "profile") {
        showError(err.message, "Could Not Update Member");
      } else if (step === "status") {
        showError(
          `Profile details were saved, but the status change failed: ${err.message}`,
          "Partial Update"
        );
        onSaved(); // profile fields did save — refresh the list to reflect that
      } else {
        showError(
          `Profile and status were saved, but the mentor change failed: ${err.message}`,
          "Partial Update"
        );
        onSaved(); // profile + status did save — refresh the list to reflect that
      }
    } finally {
      setSaving(false);
    }
  };

  // intercepts the normal submit to check for the mentor-demotion case before hitting the API
  const handleFormSubmit = async (values) => {
    const menteeCount = Number(member?.mentee_count) || 0;
    const isDemotingFromMentor =
      member?.member_status === "mentor" && values.member_status !== "mentor";

    if (isDemotingFromMentor && menteeCount > 0) {
      setPendingValues(values);
      setShowDemoteWarning(true);
      return; // wait for confirm/cancel
    }
    await doSubmit(values);
  };

  const handleConfirmDemote = async () => {
    setShowDemoteWarning(false);
    if (pendingValues) await doSubmit(pendingValues, { cascadeUnassignMentees: true });
    setPendingValues(null);
  };

  const handleCancelDemote = () => {
    setShowDemoteWarning(false);
    setPendingValues(null);
  };

  return (
    <>
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
                <DialogTitle>Edit Member</DialogTitle>
                <DialogDescription>
                  Update details and status. <span className="text-destructive">*</span> required
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit(handleFormSubmit)} className="flex min-h-0 flex-1 flex-col" noValidate>
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
                <Label>Gender</Label>
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
                {/* same picker as Connect modals */}
                <Popover open={birthOpen} onOpenChange={setBirthOpen}>
                  <PopoverTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        className="flex h-9 w-full flex-row-reverse items-center justify-between rounded-md border border-input bg-transparent px-3 font-normal shadow-xs hover:bg-transparent dark:bg-input/30"
                      />
                    }
                  >
                    <CalendarIcon size={16} className="ml-2 shrink-0 text-muted-foreground" />
                    <span className="truncate">
                      {watch("birth_date")
                        ? format(parse(watch("birth_date"), "yyyy-MM-dd", new Date()), "MMMM d, yyyy")
                        : "Select date"}
                    </span>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={watch("birth_date") ? parse(watch("birth_date"), "yyyy-MM-dd", new Date()) : undefined}
                      onSelect={(date) => {
                        if (date) setValue("birth_date", format(date, "yyyy-MM-dd"), { shouldDirty: true });
                        setBirthOpen(false);
                      }}
                      captionLayout="dropdown"
                      fromYear={1950}
                      toYear={new Date().getFullYear()}
                      disabled={{ after: new Date() }}
                      defaultMonth={watch("birth_date") ? parse(watch("birth_date"), "yyyy-MM-dd", new Date()) : undefined}
                    />
                  </PopoverContent>
                </Popover>
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

              {/* section: Church & care group */}
              <div className="mt-2 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground after:h-px after:flex-1 after:bg-border after:content-[''] sm:col-span-3">
                Church &amp; care group
              </div>
              <div className="space-y-2">
                <Label>Main church</Label>
                <Input {...register("main_church")} />
              </div>
              <div className="space-y-2">
                <Label>Ministry</Label>
                <Input {...register("ministry")} />
              </div>
              <div className="space-y-2">
                <Label>Member Status <span className="text-destructive">*</span></Label>
                <Select value={watch("member_status")} onValueChange={(v) => setValue("member_status", v, { shouldValidate: true })}>
                  <SelectTrigger className="w-full"> {/* fill the grid cell like the inputs */}
                    <SelectValue placeholder="Select status">{STATUS_LABELS[watch("member_status")]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mentor">Mentor</SelectItem>
                    <SelectItem value="potential mentor">Potential Mentor</SelectItem>
                    <SelectItem value="mentee">Mentee</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* 1 column only: starts a new row after the 3 fields above */}
              {allowMentorAssignment && (
                <div className="space-y-2">
                  <Label>Mentor</Label>
                  <Select value={selectedMentorId} onValueChange={setSelectedMentorId} disabled={!genderValue}>
                    <SelectTrigger className="w-full"> {/* fill the grid cell like the inputs */}
                      <SelectValue placeholder={genderValue ? "Select a mentor" : "Select a gender first"}>
                        {selectedMentorLabel}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {mentorsLoading && <SelectItem value="__loading" disabled>Loading...</SelectItem>}
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
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save changes"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* demote warning: same Dialog shell as the remove confirmation, destructive confirm */}
      <Dialog open={showDemoteWarning} onOpenChange={(o) => !o && handleCancelDemote()}>
        {/* max-w-lg gives long warnings room to breathe */}
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="border-b border-border py-5 pl-5 pr-12"> {/* pr-12 keeps text clear of the built-in X */}
            <div className="flex items-start gap-4">
              {/* icon badge: destructive-tinted circle */}
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle size={18} className="text-destructive" />
              </div>
              <div className="space-y-1.5 text-left">
                <DialogTitle>This mentor still has mentees assigned</DialogTitle>
                <DialogDescription>
                  <span className="font-medium text-foreground">{member?.first_name} {member?.last_name}</span> is changing away from Mentor.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* body: consequence in its own full-width panel */}
          <div className="px-5 py-4 text-sm text-muted-foreground">
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3">
              <p className="font-medium text-destructive">
                {member?.mentee_count} mentee(s) will be unassigned
              </p>
              <p className="mt-1">
                Their mentor field will be set back to "None." This cannot be undone automatically.
              </p>
            </div>
          </div>
          <DialogFooter className="border-t border-border bg-muted/30 px-5 py-4">
            <Button type="button" variant="outline" onClick={handleCancelDemote}>Cancel</Button>
            <Button
              onClick={handleConfirmDemote}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90" // red confirm, not the gold primary
            >
              Continue anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}