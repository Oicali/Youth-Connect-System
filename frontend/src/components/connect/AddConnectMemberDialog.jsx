// frontend\src\components\AddConnectMemberDialog.jsx

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { addConnectMemberSchema } from "@/lib/validations/member.js";
import {
  createMember,
  assignConnector,
  fetchMembers,
  fetchDuplicateMembers,
  setMemberStatus,
  unassignConnector,
} from "@/lib/api/members.js";
import { AlertTriangle, UserPlus, ExternalLink, Calendar as CalendarIcon } from "lucide-react";
import { useErrorModal } from "@/context/ErrorModalContext.jsx";
import { getDuplicateStatusLabel } from "@/lib/memberStatusLabels.js";

import { Button } from "@/components/ui/button.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Label } from "@/components/ui/label.jsx";
import { ChurchInput } from "@/components/ChurchInput.jsx"; // main church with suggestions
import { Calendar } from "@/components/ui/calendar.jsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.jsx";
import { format, parse } from "date-fns";
import { Badge } from "@/components/ui/badge.jsx";
import { Checkbox } from "@/components/ui/checkbox.jsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.jsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog.jsx";
import { scrollToFirstError } from "@/lib/scrollToFirstError.js"; // scroll to first field error on invalid submit

const emptyDefaults = {
  first_name: "",
  last_name: "",
  gender: "",
  birth_date: "",
  address: "",
  phone_num: "",
  alt_phone: "",
  main_church: "",
  ministry: "",
  facebook: "",
  instagram: "",
  added_at: "", // optional backdate; empty = today (PH) on the server
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

export function AddConnectMemberDialog({ open, onOpenChange, onSaved }) {
  const { showError } = useErrorModal();
  const [birthOpen, setBirthOpen] = useState(false); // birth date popover
  const [addedOpen, setAddedOpen] = useState(false); // date added popover
  // today in PH time as YYYY-MM-DD, used as the max for the date input
  const phToday = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  const [connectorId, setConnectorId] = useState("");
  const [mentorOptions, setMentorOptions] = useState([]);
  const [mentorsLoading, setMentorsLoading] = useState(false);
  const [duplicateMatches, setDuplicateMatches] = useState([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false); // true from keystroke until the duplicate lookup settles
  const [restoringId, setRestoringId] = useState(null);
  const [notDuplicate, setNotDuplicate] = useState(false); // admin confirmed the match is a different person
  const [checkFailed, setCheckFailed] = useState(false); // lookup errored: unknown is NOT "no duplicates", so Save stays locked
  const [recheckKey, setRecheckKey] = useState(0); // bump to re-run the duplicate lookup (Retry button, server 409)
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(addConnectMemberSchema),
    defaultValues: emptyDefaults,
  });

  useEffect(() => {
    if (open) {
      reset(emptyDefaults);
      setConnectorId("");
      setNotDuplicate(false);
    }
  }, [open, reset]);

  // gender is required at Connect intake (see addConnectMemberSchema), so this
  // only waits on the modal being open — same fetch pattern as AddCareGroupMemberDialog's mentor field
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
      .then(({ members }) => {
        if (!cancelled) setMentorOptions(members);
      })
      .catch(() => {
        if (!cancelled) setMentorOptions([]);
      })
      .finally(() => {
        if (!cancelled) setMentorsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, genderValue]);

  // debounced name-collision check across ALL members (mentors, mentees, other
  // Connect entries, removed) — fetchMembers({search}) has no implicit role
  // filter, same pattern as AddCareGroupMemberDialog
  const firstNameValue = watch("first_name");
  const lastNameValue = watch("last_name");
  // debounced duplicate check; checkingDuplicates locks the submit button for the whole debounce + fetch window
  useEffect(() => {
    setNotDuplicate(false); // any name change invalidates the earlier "different person" confirmation
    setCheckFailed(false); // new attempt clears the previous failure
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
        .then(({ members }) => {
          if (!cancelled) setDuplicateMatches(members);
        })
        .catch(() => {
          if (!cancelled) { setDuplicateMatches([]); setCheckFailed(true); } // fail closed
        })
        .finally(() => {
          if (!cancelled) setCheckingDuplicates(false);
        });
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, firstNameValue, lastNameValue, recheckKey]);

  // only an exact full-name match locks the submit button; partial matches are warnings only
  const exactMatch = duplicateMatches.some(
    (m) =>
      m.first_name.trim().toLowerCase() === (firstNameValue || "").trim().toLowerCase() &&
      m.last_name.trim().toLowerCase() === (lastNameValue || "").trim().toLowerCase(),
  );

  const handleRestoreAsMember = async (match) => {
    setRestoringId(match.id);
    try {
      await setMemberStatus(match.id, "mentee");
      toast.success(
        `${match.first_name} restored — you can edit their details now`,
      );
      onSaved();
      onOpenChange(false);
    } catch (err) {
      showError(err.message, "Could Not Restore Member");
    } finally {
      setRestoringId(null);
    }
  };

  // for someone who was only ever a Connect first-timer (never a full member) and
  // dropped out of follow-up — unassignConnector sets connection_status back to
  // 'pending' and clears assigned_to, which is exactly "reopen as a fresh lead"
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
      // first-timers start with no member_status at all (NULL) — they aren't a
      // "mentee" in any real sense until joinCareGroup() sets that. Only
      // connection_status is meaningful at intake.
      const { member } = await createMember({
        ...data,
        connection_status: "pending",
        confirm_different_person: notDuplicate, // server re-checks unless confirmed
      });
      // separate endpoint by design, same pattern AddCareGroupMemberDialog uses for mentor —
      // assignConnector() also flips connection_status to 'assigned' server-side,
      // overwriting the 'pending' just set above, which is the correct end state
      if (connectorId) {
        await assignConnector(member.id, connectorId);
      }
      toast.success("First-timer added to Connect");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      showError(err.message, "Could Not Add First-Timer");
      if (err.code === "DUPLICATE_NAME") setRecheckKey((k) => k + 1); // surface the warning panel + checkbox
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* p-0 + flex-col: header and footer are pinned bars, only the form body scrolls */}
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[820px]">
                <DialogHeader className="border-b border-border px-5 py-5">
          <div className="flex items-start gap-4">
            {/* icon badge: primary-tinted circle, matches the Add first-timer button */}
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <UserPlus size={18} className="text-primary" />
            </div>
            <div className="space-y-1.5 text-left">
              <DialogTitle>Add First-Timer</DialogTitle>
              <DialogDescription>
                Add a new Connect lead. <span className="text-destructive">*</span> required
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <form
          onSubmit={handleSubmit(onSubmit, scrollToFirstError)}
          className="flex min-h-0 flex-1 flex-col"
          noValidate
        >
          {/* scrollable body: 1 column on mobile, 3 columns on sm+ */}
          <div className="grid flex-1 grid-cols-1 content-start gap-4 overflow-y-auto px-7 py-5 sm:grid-cols-3">
            {/* lookup failed: Save stays locked until a retry succeeds */}
            {checkFailed && (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive sm:col-span-3">
                <span>Couldn't check for duplicate names.</span>
                <Button type="button" size="sm" variant="outline" onClick={() => setRecheckKey((k) => k + 1)}>Retry</Button>
              </div>
            )}

            {duplicateMatches.length > 0 && (
              <div className="space-y-2 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3 sm:col-span-3">
                <div className="flex items-center gap-2 text-sm font-medium text-yellow-600">
                  <AlertTriangle size={16} />
                  Possible existing member{duplicateMatches.length > 1
                    ? "s"
                    : ""}{" "}
                  found:
                </div>
                <ul className="space-y-1.5">
                  {duplicateMatches.map((match) => {
                    const { label, tone } = getDuplicateStatusLabel(match);
                    return (
                      <li
                        key={match.id}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span className="flex items-center gap-2">
                          • {match.first_name} {match.last_name}
                          <Badge
                            variant="secondary"
                            className={
                              tone === "destructive"
                                ? "text-destructive"
                                : "text-muted-foreground"
                            }
                          >
                            {label}
                          </Badge>
                        </span>
                        {match.member_status === "removed" && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleRestoreAsMember(match)}
                            disabled={restoringId === match.id}
                            className="border-success text-success hover:bg-success hover:text-success-foreground"
                          >
                            Restore instead
                          </Button>
                        )}
                        {match.member_status !== "removed" &&
                          match.connection_status === "removed" && (
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
                  <div className="flex items-center gap-2 pt-1">
                    <Checkbox
                      id="not-duplicate-connect"
                      checked={notDuplicate}
                      onCheckedChange={(v) => setNotDuplicate(v === true)} // === true keeps state a strict boolean
                    />
                    <Label htmlFor="not-duplicate-connect" className="cursor-pointer font-normal">
                      This is a different person
                    </Label>
                  </div>
                )}
              </div>
            )}

            {/* section: Personal */}
            <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground after:h-px after:flex-1 after:bg-border after:content-[''] sm:col-span-3">
              Personal
            </div>
            <div className="space-y-2">
              <Label>
                First name <span className="text-destructive">*</span>
              </Label>
              <Input {...register("first_name")} />
              {errors.first_name && (
                <p className="text-sm text-destructive">
                  {errors.first_name.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>
                Last name <span className="text-destructive">*</span>
              </Label>
              <Input {...register("last_name")} />
              {errors.last_name && (
                <p className="text-sm text-destructive">
                  {errors.last_name.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>
                Gender <span className="text-destructive">*</span>
              </Label>
              <Select
                value={watch("gender")}
                onValueChange={(v) =>
                  setValue("gender", v, { shouldValidate: true })
                }
              >
                <SelectTrigger className="w-full"> {/* fill the grid cell like the inputs */}
                  <SelectValue placeholder="Select gender">
                    {GENDER_LABELS_FORM[watch("gender")]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
              {errors.gender && (
                <p className="text-sm text-destructive">
                  {errors.gender.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Birth date</Label>
              {/* same picker as Profile's birthdate */}
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
              {errors.phone_num && (
                <p className="text-sm text-destructive">
                  {errors.phone_num.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Alt phone</Label>
              <Input {...register("alt_phone")} />
              {errors.alt_phone && (
                <p className="text-sm text-destructive">
                  {errors.alt_phone.message}
                </p>
              )}
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
              <Label>Main church <span className="text-destructive">*</span></Label>
              <ChurchInput value={watch("main_church")} onChange={(v) => setValue("main_church", v, { shouldDirty: true, shouldValidate: true })} />
              {errors.main_church && <p className="text-sm text-destructive">{errors.main_church.message}</p>} {/* required error */}
            </div>
            <div className="space-y-2">
              <Label>Ministry</Label>
              <Input {...register("ministry")} />
            </div>
            {/* optional backdate; empty = today (PH) on the server */}
            <div className="space-y-2">
              <Label>Date added </Label>
              {/* same picker as Profile; can't pick a future date */}
              <Popover open={addedOpen} onOpenChange={setAddedOpen}>
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
                    {watch("added_at")
                      ? format(parse(watch("added_at"), "yyyy-MM-dd", new Date()), "MMMM d, yyyy")
                      : "Select date"}
                  </span>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={watch("added_at") ? parse(watch("added_at"), "yyyy-MM-dd", new Date()) : undefined}
                    onSelect={(date) => {
                      if (date) setValue("added_at", format(date, "yyyy-MM-dd"), { shouldDirty: true, shouldValidate: true });
                      setAddedOpen(false);
                    }}
                    captionLayout="dropdown"
                    fromYear={new Date().getFullYear() - 10}
                    toYear={new Date().getFullYear()}
                    disabled={{ after: new Date() }}
                    defaultMonth={watch("added_at") ? parse(watch("added_at"), "yyyy-MM-dd", new Date()) : undefined}
                  />
                </PopoverContent>
              </Popover>
              {errors.added_at && (
                <p className="text-sm text-destructive">
                  {errors.added_at.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Leave empty to use today's date.
              </p>
            </div>
            {/* 1 column only: starts a new row after the 3 fields above */}
            <div className="space-y-2">
              <Label>Assign to</Label>
              <Select
                value={connectorId}
                onValueChange={setConnectorId}
                disabled={!genderValue}
              >
                <SelectTrigger className="w-full"> {/* fill the grid cell like the inputs */}
                  <SelectValue
                    placeholder={
                      genderValue ? "Select a mentor" : "Select a gender first"
                    }
                  >
                    {connectorId
                      ? mentorOptions.find((m) => String(m.id) === connectorId)
                        ? `${mentorOptions.find((m) => String(m.id) === connectorId).first_name} ${mentorOptions.find((m) => String(m.id) === connectorId).last_name}`
                        : undefined
                      : "None"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {mentorsLoading && (
                    <SelectItem value="__loading" disabled>
                      Loading...
                    </SelectItem>
                  )}
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
              disabled={
                isSubmitting ||
                checkingDuplicates ||
                checkFailed ||
                (exactMatch && !notDuplicate)
              }
            >
              {isSubmitting
                ? "Adding..."
                : checkingDuplicates
                  ? "Checking..."
                  : "Add first-timer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}