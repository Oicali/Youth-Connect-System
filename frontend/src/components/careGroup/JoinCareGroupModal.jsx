//frontend\src\components\JoinCareGroupModal.jsx
import { useState, useEffect } from "react";
import { Home } from "lucide-react";
import { toast } from "sonner";

import { fetchMembers, joinCareGroup } from "@/lib/api/members.js";
import { useErrorModal } from "@/context/ErrorModalContext.jsx";

import { Button } from "@/components/ui/button.jsx";
import { Label } from "@/components/ui/label.jsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.jsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog.jsx";

export function JoinCareGroupModal({ member, open, onOpenChange, onSaved }) {
  const { showError } = useErrorModal();
  const [mentorId, setMentorId] = useState("");
  const [mentorOptions, setMentorOptions] = useState([]);
  const [loadingMentors, setLoadingMentors] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !member) { setMentorOptions([]); setMentorId(""); return; }
    // mentors filtered by the member's own gender — same rule AddCareGroupMemberDialog uses
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
      {/* same shell as the other modals: p-0 + flex-col so header and footer are pinned bars */}
      <DialogContent className="flex flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border py-5 pl-5 pr-12">
          <div className="flex items-start gap-4">
            {/* icon badge: success-tinted circle, matches the green Home button in the table */}
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success/10">
              <Home size={18} className="text-success" />
            </div>
            <div className="space-y-1.5 text-left">
              <DialogTitle>Join Care Group</DialogTitle>
              <DialogDescription>
                Assign an official mentor to{" "}
                <span className="font-medium text-foreground">{member?.first_name} {member?.last_name}</span>.
                This also closes out their Connect status.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-2 px-5 py-5">
          <Label>Mentor <span className="text-destructive">*</span></Label>
          <Select value={mentorId} onValueChange={setMentorId} disabled={!member?.gender}>
            <SelectTrigger className="w-full"> {/* fill the modal width like the inputs */}
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
          {/* explains why the list is short: it's filtered by the member's gender */}
          {member?.gender && (
            <p className="text-xs text-muted-foreground">
              Showing <span className="capitalize">{member.gender}</span> mentors only.
            </p>
          )}
        </div>

        {/* pinned footer bar, same as the other modals */}
        <DialogFooter className="border-t border-border bg-muted/30 px-5 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={!mentorId || submitting}
            className="bg-success text-success-foreground hover:bg-success/90" // green confirm, same color as the Home button that opens this modal
          >
            {submitting ? "Saving..." : "Confirm join"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}