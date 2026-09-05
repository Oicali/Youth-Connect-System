// frontend/src/components/EditMemberModal.jsx
import { useEffect, useState, useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { editMemberSchema } from "@/lib/validations/member";
import {
  updateMember, setMemberStatus, assignMentor, unassignMentor, fetchMembers,
} from "@/lib/api/members";
import { useErrorModal } from "@/context/ErrorModalContext";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";

const STATUS_LABELS = {
  mentor: "Mentor",
  "potential mentor": "Potential Mentor",
  mentee: "Mentee",
};
const GENDER_LABELS_FORM = { male: "Male", female: "Female" };

function toFormValues(member) {
  return {
    member_status: member?.member_status || "mentee",
    first_name: member?.first_name || "",
    last_name: member?.last_name || "",
    gender: member?.gender || "",
    birth_date: member?.birth_date ? member.birth_date.slice(0, 10) : "",
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
  const [duplicateMatches, setDuplicateMatches] = useState([]);

  useEffect(() => {
    if (!open) return;
    reset(toFormValues(member));
    setSelectedMentorId(member?.mentor_id ? String(member.mentor_id) : "");
  }, [member, open, reset]);

  // gender drives the mentor list — refetch on any live change, not just the member's saved gender
  const genderValue = watch("gender");

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
      // exclude the member being edited — relevant now that this dropdown shows
      // on the Mentors tab too, where the person being edited IS a mentor
      .then(({ members }) => { if (!cancelled) setMentorOptions(members.filter((m) => m.id !== member?.id)); })
      .catch(() => { if (!cancelled) setMentorOptions([]); })
      .finally(() => { if (!cancelled) setMentorsLoading(false); });
    return () => { cancelled = true; };
  }, [open, allowMentorAssignment, genderValue]);

  // hard block: warn AND prevent saving if this name now matches a different existing
  // member (any status). Unlike Add, there's no "restore instead" option that makes
  // sense here — you're renaming an existing person, not creating a new one.
  const firstNameValue = watch("first_name");
  const lastNameValue = watch("last_name");
  useEffect(() => {
    if (!open) { setDuplicateMatches([]); return; }
    const term = `${firstNameValue || ""} ${lastNameValue || ""}`.trim();
    if (term.replace(/\s/g, "").length < 2) { setDuplicateMatches([]); return; }

    let cancelled = false;
    const timer = setTimeout(() => {
      fetchMembers({ search: term, limit: 5 })
        .then(({ members }) => {
          if (cancelled) return;
          setDuplicateMatches(members.filter((m) => m.id !== member?.id));
        })
        .catch(() => { if (!cancelled) setDuplicateMatches([]); });
    }, 400);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [open, firstNameValue, lastNameValue, member]);

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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit {member?.first_name}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="grid grid-cols-2 gap-4" noValidate>
          {duplicateMatches.length > 0 && (
            <div className="col-span-2 space-y-1 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                <AlertTriangle size={16} />
                This name matches an existing member:
              </div>
              <ul className="space-y-1">
                {duplicateMatches.map((match) => (
                  <li key={match.id} className="text-sm">
                    • {match.first_name} {match.last_name}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="col-span-2 space-y-2">
            <Label>Status <span className="text-destructive">*</span></Label>
            <Select value={watch("member_status")} onValueChange={(v) => setValue("member_status", v, { shouldValidate: true })}>
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
            <Select value={watch("gender")} onValueChange={(v) => setValue("gender", v, { shouldValidate: true })}>
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

          {allowMentorAssignment && (
            <div className="col-span-2 space-y-2">
              <Label>Mentor</Label>
              <Select value={selectedMentorId} onValueChange={setSelectedMentorId} disabled={!genderValue}>
                <SelectTrigger>
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
            <Button type="submit" disabled={saving || duplicateMatches.length > 0}>
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <AlertDialog open={showDemoteWarning} onOpenChange={(o) => !o && handleCancelDemote()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>This mentor still has mentees assigned</AlertDialogTitle>
          <AlertDialogDescription>
            {member?.first_name} {member?.last_name} has {member?.mentee_count} mentee(s) assigned.
            Changing their status away from Mentor will unassign all of those mentees —
            their mentor field will be set back to "None." This cannot be undone automatically.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancelDemote}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirmDemote}>Continue anyway</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}