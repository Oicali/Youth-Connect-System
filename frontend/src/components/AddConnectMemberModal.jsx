// frontend\src\components\AddConnectMemberModal.jsx

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { addConnectMemberSchema } from "@/lib/validations/member";
import { createMember, assignConnector, fetchMembers, setMemberStatus } from "@/lib/api/members";
import { AlertTriangle } from "lucide-react";
import { useErrorModal } from "@/context/ErrorModalContext";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const emptyDefaults = {
  first_name: "", last_name: "", gender: "", birth_date: "",
  address: "", phone_num: "", alt_phone: "", main_church: "",
  ministry: "", facebook: "", instagram: "",
};
const GENDER_LABELS_FORM = { male: "Male", female: "Female" };

export function AddConnectMemberModal({ open, onOpenChange, onSaved }) {
  const { showError } = useErrorModal();
  const [connectorId, setConnectorId] = useState("");
  const [mentorOptions, setMentorOptions] = useState([]);
  const [mentorsLoading, setMentorsLoading] = useState(false);
  const [duplicateMatches, setDuplicateMatches] = useState([]);
  const [restoringId, setRestoringId] = useState(null);
  const {
    register, handleSubmit, reset, setValue, watch,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(addConnectMemberSchema), defaultValues: emptyDefaults });

  useEffect(() => { if (open) { reset(emptyDefaults); setConnectorId(""); } }, [open, reset]);

  // gender is required at Connect intake (see addConnectMemberSchema), so this
  // only waits on the modal being open — same fetch pattern as AddMemberModal's mentor field
  const genderValue = watch("gender");
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

  // debounced name-collision check across ALL members (mentors, mentees, other
  // Connect entries, removed) — fetchMembers({search}) has no implicit role
  // filter, same pattern as AddMemberModal
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

  const handleRestoreAsMember = async (match) => {
    setRestoringId(match.id);
    try {
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

  const onSubmit = async (data) => {
    try {
      // first-timers start with no member_status at all (NULL) — they aren't a
      // "mentee" in any real sense until joinCareGroup() sets that. Only
      // connection_status is meaningful at intake.
      const { member } = await createMember({ ...data, connection_status: "pending" });
      // separate endpoint by design, same pattern AddMemberModal uses for mentor —
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
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>Add First-Timer</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4" noValidate>
          {duplicateMatches.length > 0 && (
            <div className="col-span-2 space-y-2 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-yellow-600">
                <AlertTriangle size={16} />
                Possible existing member{duplicateMatches.length > 1 ? "s" : ""} found:
              </div>
              <ul className="space-y-1.5">
                {duplicateMatches.map((match) => (
                  <li key={match.id} className="flex items-center justify-between gap-2 text-sm">
                    <span>• {match.first_name} {match.last_name}</span>
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
                  </li>
                ))}
              </ul>
            </div>
          )}

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

          <div className="col-span-2 space-y-2">
            <Label>Assign to (optional)</Label>
            <Select value={connectorId} onValueChange={setConnectorId} disabled={!genderValue}>
              <SelectTrigger>
                <SelectValue placeholder={genderValue ? "Select a mentor" : "Select a gender first"}>
                  {connectorId
                    ? mentorOptions.find((m) => String(m.id) === connectorId)
                      ? `${mentorOptions.find((m) => String(m.id) === connectorId).first_name} ${mentorOptions.find((m) => String(m.id) === connectorId).last_name}`
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

          <DialogFooter className="col-span-2">
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Adding..." : "Add first-timer"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}