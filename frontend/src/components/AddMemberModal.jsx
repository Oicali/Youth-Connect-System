// frontend/src/components/AddMemberModal.jsx
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { format, parse } from "date-fns";

import { addMemberSchema } from "@/lib/validations/member";
import {
  createMember, assignMentor, fetchMembers, fetchDuplicateMembers, setMemberStatus, unassignConnector,
} from "@/lib/api/members";
import { AlertTriangle, UserPlus, ExternalLink, Calendar as CalendarIcon } from "lucide-react";
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

const emptyDefaults = {
  member_status: "mentee",
  first_name: "", last_name: "", gender: "", birth_date: "",
  address: "", phone_num: "", alt_phone: "", main_church: "",
  ministry: "", facebook: "", instagram: "",
};

// human labels for the trigger display — Radix SelectValue won't resolve a matched
// item's text for values set programmatically (reset/setValue), only for values
// picked via an actual click, so we pass the label explicitly instead of relying on it
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

export function AddMemberModal({ open, onOpenChange, onSaved }) {
  const { showError } = useErrorModal();
  const [birthOpen, setBirthOpen] = useState(false); // birth date popover

  const [selectedMentorId, setSelectedMentorId] = useState("");
  const [mentorOptions, setMentorOptions] = useState([]);
  const [mentorsLoading, setMentorsLoading] = useState(false);

  const [duplicateMatches, setDuplicateMatches] = useState([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false); // true from keystroke until the duplicate lookup settles
  const [restoringId, setRestoringId] = useState(null);
  const [notDuplicate, setNotDuplicate] = useState(false); // admin confirmed the match is a different person

  const {
    register, handleSubmit, reset, setValue, watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(addMemberSchema),
    defaultValues: emptyDefaults,
  });

  useEffect(() => {
    if (open) {
      reset(emptyDefaults);
      setSelectedMentorId("");
      setNotDuplicate(false);
    }
  }, [open, reset]);

  // gender drives the mentor list
  const genderValue = watch("gender");
  // clickable profile links, null while the field isn't a recognizable link
  const facebookUrl = toSocialUrl(watch("facebook"), FACEBOOK_HOSTS);
  const instagramUrl = toSocialUrl(watch("instagram"), INSTAGRAM_HOSTS);
  useEffect(() => {
    if (!open || !genderValue) {
      setMentorOptions([]);
      return;
    }
    let cancelled = false;
    setMentorsLoading(true);
    fetchMembers({ role: ["mentor"], gender: genderValue, limit: 50 })
      .then(({ members }) => { if (!cancelled) setMentorOptions(members); })
      .catch(() => { if (!cancelled) setMentorOptions([]); })
      .finally(() => { if (!cancelled) setMentorsLoading(false); });
    return () => { cancelled = true; };
  }, [open, genderValue]);

  // debounced name-collision check across ALL members (any status, including removed);
  // catches re-adding someone who's already archived before a duplicate gets created
  const firstNameValue = watch("first_name");
  const lastNameValue = watch("last_name");
  useEffect(() => {
    setNotDuplicate(false); // any name change invalidates the earlier "different person" confirmation
    if (!open) {
      setDuplicateMatches([]);
      setCheckingDuplicates(false);
      return;
    }
    const first = (firstNameValue || "").trim();
    const last = (lastNameValue || "").trim();
    // partial matching: check from the first 2 characters of either name
    if ((first + last).length < 2) {
      setDuplicateMatches([]);
      setCheckingDuplicates(false);
      return;
    }

    let cancelled = false;
    setCheckingDuplicates(true);
    const timer = setTimeout(() => {
      fetchDuplicateMembers(first, last)
        .then(({ members }) => { if (!cancelled) setDuplicateMatches(members); })
        .catch(() => { if (!cancelled) setDuplicateMatches([]); })
        .finally(() => { if (!cancelled) setCheckingDuplicates(false); });
    }, 400);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [open, firstNameValue, lastNameValue]);

  // only an exact full-name match locks the submit button; partial matches are warnings only
  const exactMatch = duplicateMatches.some(
    (m) =>
      m.first_name.trim().toLowerCase() === (firstNameValue || "").trim().toLowerCase() &&
      m.last_name.trim().toLowerCase() === (lastNameValue || "").trim().toLowerCase(),
  );

  const handleRestoreMatch = async (match) => {
    setRestoringId(match.id);
    try {
      // restores to mentee by default — same safe default used in ArchiveMembersModal,
      // since it's the only restore target that never triggers a mentor-cascade
      await setMemberStatus(match.id, "mentee");
      toast.success(`${match.first_name} restored — you can edit their details now`);
      onSaved();
      onOpenChange(false);
    } catch (err) {
      showError(err.message, "Could Not Restore Member");
    } finally {
      setRestoringId(null);
    }
  };

  // covers a match who was only ever a Connect first-timer (never a full member,
  // member_status stayed NULL) and dropped out of follow-up
  const handleResumeFollowUp = async (match) => {
    setRestoringId(match.id);
    try {
      await unassignConnector(match.id);
      toast.success(`${match.first_name} moved back to pending follow-up`);
      onSaved();
      onOpenChange(false);
    } catch (err) {
      showError(err.message, "Could Not Resume Follow-Up");
    } finally {
      setRestoringId(null);
    }
  };

  const onSubmit = async (data) => {
    try {
      const { member } = await createMember(data);
      // separate endpoint by design — POST /members doesn't accept mentor_id server-side
      if (selectedMentorId) {
        await assignMentor(member.id, selectedMentorId);
      }
      toast.success("Member created");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      showError(err.message, "Could Not Create Member");
    }
  };

  // label for the mentor trigger, resolved once instead of three find() calls inline
  const selectedMentor = mentorOptions.find((m) => String(m.id) === selectedMentorId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* p-0 + flex-col: header and footer are pinned bars, only the form body scrolls */}
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[820px]">
        <DialogHeader className="border-b border-border px-5 py-5">
          <div className="flex items-start gap-4">
            {/* icon badge: primary-tinted circle, matches the Add member button */}
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <UserPlus size={18} className="text-primary" />
            </div>
            <div className="space-y-1.5 text-left">
              <DialogTitle>Add Member</DialogTitle>
              <DialogDescription>
                Add a mentor, potential mentor, or mentee. <span className="text-destructive">*</span> required
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col" noValidate>
          {/* scrollable body: 1 column on mobile, 3 columns on sm+ */}
          <div className="grid flex-1 grid-cols-1 content-start gap-4 overflow-y-auto px-7 py-5 sm:grid-cols-3">
            {duplicateMatches.length > 0 && (
              <div className="space-y-2 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3 sm:col-span-3">
                <div className="flex items-center gap-2 text-sm font-medium text-yellow-600">
                  <AlertTriangle size={16} />
                  Possible existing member{duplicateMatches.length > 1 ? "s" : ""} found:
                </div>
                <ul className="space-y-1.5">
                  {duplicateMatches.map((match) => {
                    const { label, tone } = getDuplicateStatusLabel(match);
                    return (
                      <li key={match.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="flex items-center gap-2">
                          • {match.first_name} {match.last_name}
                          <Badge variant="secondary" className={tone === "destructive" ? "text-destructive" : "text-muted-foreground"}>
                            {label}
                          </Badge>
                        </span>
                        {match.member_status === "removed" && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleRestoreMatch(match)}
                            disabled={restoringId === match.id}
                            className="border-success text-success hover:bg-success hover:text-success-foreground"
                          >
                            Restore instead
                          </Button>
                        )}
                        {match.member_status !== "removed" && match.connection_status === "removed" && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleResumeFollowUp(match)}
                            disabled={restoringId === match.id}
                            className="border-success text-success hover:bg-success hover:text-success-foreground"
                          >
                            Resume follow-up
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {/* only shown for an exact name match, the only case that locks the button */}
                {exactMatch && (
                  <label className="flex items-center gap-2 pt-1 text-sm">
                    <input
                      type="checkbox"
                      checked={notDuplicate}
                      onChange={(e) => setNotDuplicate(e.target.checked)}
                    />
                    This is a different person
                  </label>
                )}
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
              <Select value={watch("member_status")} onValueChange={(v) => setValue("member_status", v)}>
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
            <div className="space-y-2">
              <Label>Mentor</Label>
              <Select value={selectedMentorId} onValueChange={setSelectedMentorId} disabled={!genderValue}>
                <SelectTrigger className="w-full"> {/* fill the grid cell like the inputs */}
                  <SelectValue placeholder={genderValue ? "Select a mentor" : "Select a gender first"}>
                    {selectedMentorId
                      ? selectedMentor ? `${selectedMentor.first_name} ${selectedMentor.last_name}` : undefined
                      : "None"}
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
          </div>

          {/* pinned footer bar, outside the scrolling body */}
          <DialogFooter className="border-t bg-muted/30 px-7 py-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || checkingDuplicates || (exactMatch && !notDuplicate)}
            >
              {isSubmitting ? "Creating..." : checkingDuplicates ? "Checking..." : "Create member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}