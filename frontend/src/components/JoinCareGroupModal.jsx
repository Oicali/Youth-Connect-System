//frontend\src\components\JoinCareGroupModal.jsx
import { useState, useEffect } from "react";
import { toast } from "sonner";

import { fetchMembers, joinCareGroup } from "@/lib/api/members";
import { useErrorModal } from "@/context/ErrorModalContext";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

export function JoinCareGroupModal({ member, open, onOpenChange, onSaved }) {
  const { showError } = useErrorModal();
  const [mentorId, setMentorId] = useState("");
  const [mentorOptions, setMentorOptions] = useState([]);
  const [loadingMentors, setLoadingMentors] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !member) { setMentorOptions([]); setMentorId(""); return; }
    // mentors filtered by the member's own gender — same rule AddMemberModal uses
    setLoadingMentors(true);
    fetchMembers({ role: ["mentor"], gender: member.gender, limit: 50 })
      .then(({ members }) => setMentorOptions(members))
      .catch(() => setMentorOptions([]))
      .finally(() => setLoadingMentors(false));
    // pre-fill with their existing Connect connector — assignConnector now requires
    // the connector to be a mentor, but gender-match on connector is still UI-only
    // (not enforced server-side), so this pre-fill may not appear in mentorOptions above
    setMentorId(member.assigned_to ? String(member.assigned_to) : "");
  }, [open, member]);

  const handleSubmit = async () => {
    if (!mentorId) return;
    setSubmitting(true);
    try {
      await joinCareGroup(member.id, mentorId);
      toast.success(`${member.first_name} moved into a care group`);
      onSaved();
      onOpenChange(false);
    } catch (err) {
      showError(err.message, "Could Not Complete Care Group Join");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedLabel = mentorOptions.find((m) => String(m.id) === mentorId);
  // covers the pre-filled connector when they've fallen outside the gender-filtered list
  const isPrefilledConnector = member?.assigned_to && String(member.assigned_to) === mentorId;
  const fallbackLabel = isPrefilledConnector && member?.connector_first_name
    ? `${member.connector_first_name} ${member.connector_last_name}`
    : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Care Group — {member?.first_name} {member?.last_name}</DialogTitle>
          <DialogDescription>
            Assigns an official mentor and closes out their Connect pipeline status.
          </DialogDescription>
        </DialogHeader>

        <Select value={mentorId} onValueChange={setMentorId} disabled={!member?.gender}>
          <SelectTrigger>
            <SelectValue placeholder={member?.gender ? "Select a mentor" : "No gender on file"}>
              {selectedLabel ? `${selectedLabel.first_name} ${selectedLabel.last_name}` : fallbackLabel}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {loadingMentors && <SelectItem value="__loading" disabled>Loading...</SelectItem>}
            {isPrefilledConnector && !selectedLabel && (
              <SelectItem value={mentorId}>{fallbackLabel} (current connector)</SelectItem>
            )}
            {mentorOptions.map((mentorOpt) => (
              <SelectItem key={mentorOpt.id} value={String(mentorOpt.id)}>
                {mentorOpt.first_name} {mentorOpt.last_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={!mentorId || submitting}>
            {submitting ? "Saving..." : "Confirm join"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}