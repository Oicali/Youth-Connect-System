//frontend\src\components\EditConnectMemberModal.jsx

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { editConnectMemberSchema } from "@/lib/validations/member";
import { updateMember, assignConnector, unassignConnector, fetchMembers } from "@/lib/api/members";
import { useErrorModal } from "@/context/ErrorModalContext";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const GENDER_LABELS_FORM = { male: "Male", female: "Female" };

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
});

export function EditConnectMemberModal({ member, open, onOpenChange, onSaved }) {
  const { showError } = useErrorModal();
  const {
    register, handleSubmit, reset, setValue, watch,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(editConnectMemberSchema), defaultValues: buildDefaults(null) });

  // connector lives outside react-hook-form — it's saved via assignConnector/
  // unassignConnector, a different endpoint than PUT /members/:id
  const [connectorId, setConnectorId] = useState("");
  const [mentorOptions, setMentorOptions] = useState([]);
  const [mentorsLoading, setMentorsLoading] = useState(false);
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>Edit First-Timer</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4" noValidate>
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

          {!isRemoved && (
            <div className="col-span-2 space-y-2">
              <Label>Assign to (optional)</Label>
              <Select value={connectorId} onValueChange={setConnectorId} disabled={!genderValue}>
                <SelectTrigger>
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

          <DialogFooter className="col-span-2">
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Save changes"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}