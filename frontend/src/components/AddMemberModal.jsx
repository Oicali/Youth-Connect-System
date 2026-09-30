// frontend/src/components/AddMemberModal.jsx
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { addMemberSchema } from "@/lib/validations/member";
import { createMember, assignMentor, fetchMembers, setMemberStatus, unassignConnector } from "@/lib/api/members";
import { AlertTriangle } from "lucide-react";
import { useErrorModal } from "@/context/ErrorModalContext";
import { getDuplicateStatusLabel } from "@/lib/memberStatusLabels";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
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

export function AddMemberModal({ open, onOpenChange, onSaved }) {
  const { showError } = useErrorModal();

  const [selectedMentorId, setSelectedMentorId] = useState("");
  const [mentorOptions, setMentorOptions] = useState([]);
  const [mentorsLoading, setMentorsLoading] = useState(false);

  const [duplicateMatches, setDuplicateMatches] = useState([]);
  const [restoringId, setRestoringId] = useState(null);

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
    }
  }, [open, reset]);

  // gender + status drive the mentor list — a removed member can't be assigned a mentor
  const genderValue = watch("gender");
  const statusValue = watch("member_status");
  useEffect(() => {
    if (!open || !genderValue || statusValue === "removed") {
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
  }, [open, genderValue, statusValue]);

  // debounced name-collision check — searches ALL statuses (including "removed")
  // since fetchMembers({search}) has no implicit role filter unless "role" is passed.
  // Goal: catch re-adding someone who's already archived before a duplicate gets created.
  const firstNameValue = watch("first_name");
  const lastNameValue = watch("last_name");
  useEffect(() => {
    if (!open) { setDuplicateMatches([]); return; }
    const term = `${firstNameValue || ""} ${lastNameValue || ""}`.trim();
    if (term.replace(/\s/g, "").length < 2) { setDuplicateMatches([]); return; }

    let cancelled = false;
    const timer = setTimeout(() => {
      fetchMembers({ search: term, limit: 3 })
        .then(({ members }) => { if (!cancelled) setDuplicateMatches(members); })
        .catch(() => { if (!cancelled) setDuplicateMatches([]); });
    }, 400);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [open, firstNameValue, lastNameValue]);

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
      if (err.field) {
        showError(err.message, "Could Not Create Member");
      } else {
        showError(err.message, "Could Not Create Member");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Member</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4" noValidate>
          {duplicateMatches.length > 0 && (
            <div className="col-span-2 space-y-2 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3">
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
            </div>
          )}

          <div className="col-span-2 space-y-2">
            <Label>Status <span className="text-destructive">*</span></Label>
            <Select value={watch("member_status")} onValueChange={(v) => setValue("member_status", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select status">{STATUS_LABELS[watch("member_status")]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mentor">Mentor</SelectItem>
                <SelectItem value="potential mentor">Potential Mentor</SelectItem>
                <SelectItem value="mentee">Mentee</SelectItem>
              </SelectContent>
            </Select>
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
            <Select value={watch("gender")} onValueChange={(v) => setValue("gender", v)}>
              <SelectTrigger>
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

          {statusValue !== "removed" && (
            <div className="col-span-2 space-y-2">
              <Label>Mentor (optional)</Label>
              <Select value={selectedMentorId} onValueChange={setSelectedMentorId} disabled={!genderValue}>
                <SelectTrigger>
                  <SelectValue placeholder={genderValue ? "Select a mentor" : "Select a gender first"}>
                    {selectedMentorId
                      ? mentorOptions.find((m) => String(m.id) === selectedMentorId)
                        ? `${mentorOptions.find((m) => String(m.id) === selectedMentorId).first_name} ${mentorOptions.find((m) => String(m.id) === selectedMentorId).last_name}`
                        : undefined
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
          )}

          

          <div className="col-span-2 space-y-2">
            <Label>Address</Label>
            <Input {...register("address")} />
          </div>

          <div className="space-y-2">
            <Label>Phone <span className="text-destructive">*</span></Label>
            <Input {...register("phone_num")} />
            {errors.phone_num && <p className="text-sm text-destructive">{errors.phone_num.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Alt phone</Label>
            <Input {...register("alt_phone")} />
            {errors.alt_phone && <p className="text-sm text-destructive">{errors.alt_phone.message}</p>}
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
            <Label>Facebook</Label>
            <Input {...register("facebook")} />
          </div>
          <div className="space-y-2">
            <Label>Instagram</Label>
            <Input {...register("instagram")} />
          </div>

          <DialogFooter className="col-span-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}