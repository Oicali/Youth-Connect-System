// frontend/src/pages/CareGroup.jsx

import { useState, useEffect, useCallback, useMemo } from "react";
import { Pencil, Trash2, Search as SearchIcon, Undo2, Users, User, UserPlus, Archive } from "lucide-react";
import { toast } from "sonner";

import { fetchMembers, setMemberStatus } from "@/lib/api/members";
import { AddMemberModal } from "@/components/AddMemberModal";
import { EditMemberModal } from "@/components/EditMemberModal";
import { ArchiveMembersModal } from "@/components/ArchiveMembersModal";
import { useLoadingModal } from "@/context/LoadingModalContext";
import { useErrorModal } from "@/context/ErrorModalContext";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

const TABS = [
  { key: "mentors", label: "Mentors", memberStatus: ["mentor"] },
  {
    key: "mentees",
    label: "Members",
    memberStatus: ["mentee", "potential mentor", "hybrid"],
  },
];

// "hybrid" = a mentor who also has their own mentor_id set — shown as "Mentee/Mentor"
const MENTEE_STATUS_LABELS = {
  all: "All statuses",
  mentee: "Mentee",
  "potential mentor": "Potential Mentor",
  hybrid: "Mentee/Mentor",
};

const GENDER_LABELS = {
  all: "All genders",
  male: "Male",
  female: "Female",
};

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const getMenteeStatusLabel = (m) => {
  if (m.member_status === "mentor" && m.mentor_id) return "Mentee/Mentor";
  return m.member_status;
};

export default function CareGroup() {
  const [activeTab, setActiveTab] = useState("mentors");
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const LIMIT = 15;
  const [page, setPage] = useState(1);

  // only meaningful on the Mentees tab for now
  const [pendingGender, setPendingGender] = useState("all");
  const [gender, setGender] = useState("all");
  const [pendingMenteeStatus, setPendingMenteeStatus] = useState("all");
  const [menteeStatus, setMenteeStatus] = useState("all");

  const { showError } = useErrorModal();
  const { runWithLoading } = useLoadingModal();
  const [editingMember, setEditingMember] = useState(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deletingMember, setDeletingMember] = useState(null);

  const handleConfirmDelete = async () => {
    try {
      // cascadeUnassignMentees is a no-op unless the target was actually a mentor
      // (service checks wasMentor internally) — safe to always pass true here so
      // this matches the dropdown's demotion behavior exactly, regardless of role
      await setMemberStatus(deletingMember.id, "removed", { cascadeUnassignMentees: true });
      toast.success("Member removed");
      setDeletingMember(null);
      loadMembers();
    } catch (err) {
      showError(err.message, "Could Not Remove Member");
    }
  };

  const isMenteesTab = activeTab === "mentees";
  const tabDefaultStatus = TABS.find((t) => t.key === activeTab)?.memberStatus;

  // if a specific mentee status is picked, it narrows the tab's default set
  // down to just that one token; otherwise use the tab's full default set
  const effectiveRole = useMemo(
    () =>
      isMenteesTab && menteeStatus !== "all"
        ? [menteeStatus]
        : tabDefaultStatus,
    [isMenteesTab, menteeStatus, tabDefaultStatus],
  );

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const { members, total } = await runWithLoading(
        "Searching members...",
        () =>
          fetchMembers({
            search,
            role: effectiveRole,
            gender,
            page,
            limit: LIMIT,
          }),
      );
      setMembers(members);
      setTotal(total);
    } catch (err) {
      showError(err.message, "Could Not Load Members");
    } finally {
      setLoading(false);
    }
  }, [search, effectiveRole, gender, isMenteesTab, page]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  useEffect(() => {
    setSearchInput("");
    setSearch("");
    setPendingGender("all");
    setGender("all");
    setPendingMenteeStatus("all");
    setMenteeStatus("all");
    setPage(1);
  }, [activeTab]);

  const handleApplyFilters = () => {
    setSearch(searchInput.trim());
    setGender(pendingGender);
    setMenteeStatus(pendingMenteeStatus);
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearchInput("");
    setSearch("");
    setPendingGender("all");
    setGender("all");
    setPendingMenteeStatus("all");
    setMenteeStatus("all");
    setPage(1);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleApplyFilters();
    }
  };

  const filtersDirty =
    searchInput.trim() !== search ||
    pendingGender !== gender ||
    (isMenteesTab && pendingMenteeStatus !== menteeStatus);

  const filtersAtDefault =
    !searchInput &&
    !search &&
    pendingGender === "all" &&
    gender === "all" &&
    pendingMenteeStatus === "all" &&
    menteeStatus === "all";

  const colSpan = isMenteesTab ? 8 : 7;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Care Group</h1>
          <p className="text-sm text-muted-foreground">
            Manage mentors and mentees in your care group
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setArchiveOpen(true)}>
            <Archive size={16} className="mr-2" />
            Archive
          </Button>
          <Button onClick={() => setAddDialogOpen(true)}>
            <UserPlus size={16} className="mr-2" />
            Add member
          </Button>
        </div>
      </div>

      <div className="flex gap-2 border-b">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors -mb-px border-b-2 ${
              activeTab === tab.key
                ? "bg-primary/10 border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-[200px] flex-1 flex-col gap-1">
            <span className="px-1 text-xs text-muted-foreground">Search</span>
            <Input
              placeholder={
                isMenteesTab
                  ? "Search name, phone, church, or mentor..."
                  : "Search name, phone, or church..."
              }
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="bg-card"
            />
          </div>

          <div className="flex min-w-[140px] flex-1 flex-col gap-1 sm:flex-none">
            <span className="px-1 text-xs text-muted-foreground">Gender</span>
            <Select value={pendingGender} onValueChange={setPendingGender}>
              <SelectTrigger className="w-full bg-card sm:w-40">
                <SelectValue placeholder="Gender">
                  {GENDER_LABELS[pendingGender]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All genders</SelectItem>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isMenteesTab && (
            <div className="flex min-w-[160px] flex-1 flex-col gap-1 sm:flex-none">
              <span className="px-1 text-xs text-muted-foreground">Status</span>
              <Select
                value={pendingMenteeStatus}
                onValueChange={setPendingMenteeStatus}
              >
                <SelectTrigger className="w-full bg-card sm:w-44">
                  <SelectValue placeholder="Status">
                    {MENTEE_STATUS_LABELS[pendingMenteeStatus]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="mentee">Mentee</SelectItem>
                  <SelectItem value="potential mentor">
                    Potential Mentor
                  </SelectItem>
                  <SelectItem value="hybrid">Mentee/Mentor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant={filtersDirty ? "default" : "outline"}
              size="icon"
              onClick={handleApplyFilters}
              disabled={!filtersDirty}
              aria-label="Apply filters"
              className="shrink-0"
            >
              <SearchIcon size={16} />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleResetFilters}
              disabled={filtersAtDefault}
              aria-label="Reset filters"
              className="shrink-0"
            >
              <Undo2 size={16} />
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Gender</TableHead>
              {isMenteesTab && <TableHead>Status</TableHead>}
              {!isMenteesTab && <TableHead>Mentees</TableHead>}
              {isMenteesTab && <TableHead>Mentor</TableHead>}
              <TableHead>Main Church</TableHead>
              <TableHead>Updated At</TableHead>
              <TableHead className="pr-8 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={colSpan}
                  className="text-center text-muted-foreground"
                >
                  Loading...
                </TableCell>
              </TableRow>
            ) : members.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={colSpan}
                  className="text-center text-muted-foreground"
                >
                  No {activeTab} found
                </TableCell>
              </TableRow>
            ) : (
              members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="pl-4">
                    {m.first_name} {m.last_name}
                  </TableCell>
                  <TableCell>{m.phone_num}</TableCell>
                  <TableCell className="capitalize">{m.gender}</TableCell>

                  {isMenteesTab && (
                    <TableCell>
                      <Badge className="capitalize" variant="secondary">
                        {getMenteeStatusLabel(m)}
                      </Badge>
                    </TableCell>
                  )}

                  {!isMenteesTab && (
                    <TableCell>
                      {Number(m.mentee_count) > 0 ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge
                                variant="secondary"
                                className="inline-flex cursor-default items-center gap-1"
                              >
                                <Users size={14} />
                                {Number(m.mentee_count)}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent
                              side="right"
                              sideOffset={8}
                              className="w-56 flex-col items-start rounded-xl p-3"
                            >
                              <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                                Mentees
                              </p>
                              <div className="my-2 w-full border-t border-border" />
                              <ul className="flex w-full flex-col gap-1.5">
                                {(m.mentee_names || []).map((name) => (
                                  <li
                                    key={name}
                                    className="flex items-center gap-2 text-sm"
                                  >
                                    <User
                                      size={14}
                                      className="shrink-0 text-primary"
                                    />
                                    <span>{name}</span>
                                  </li>
                                ))}
                              </ul>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="inline-flex items-center gap-1"
                        >
                          <Users size={14} />0
                        </Badge>
                      )}
                    </TableCell>
                  )}

                  {isMenteesTab && (
                    <TableCell className="text-muted-foreground">
                      {m.mentor_first_name
                        ? `${m.mentor_first_name} ${m.mentor_last_name}`
                        : "—"}
                    </TableCell>
                  )}

                  <TableCell>{m.main_church || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(m.updated_at)}
                  </TableCell>
                  <TableCell className="flex justify-end gap-2 pr-4">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingMember(m)}
                      className="bg-primary/10 hover:bg-primary/20"
                    >
                      <Pencil size={16} className="text-primary" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeletingMember(m)}
                      className="bg-destructive/10 hover:bg-destructive/20"
                    >
                      <Trash2 size={16} className="text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {total > LIMIT && (
        <div className="flex items-center justify-between px-1">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of{" "}
            {total} records
          </p>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p - 1)}
              disabled={page <= 1 || loading}
            >
              Previous
            </Button>
            <span className="text-sm font-medium">
              Page {page} of {Math.ceil(total / LIMIT)}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= Math.ceil(total / LIMIT) || loading}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <AddMemberModal
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSaved={loadMembers}
      />

      <ArchiveMembersModal
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        onRestored={loadMembers}
      />

      <EditMemberModal
        member={editingMember}
        open={!!editingMember}
        onOpenChange={(o) => !o && setEditingMember(null)}
        onSaved={loadMembers}
        allowMentorAssignment
      />

      <AlertDialog
        open={!!deletingMember}
        onOpenChange={(o) => !o && setDeletingMember(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this member?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingMember && Number(deletingMember.mentee_count) > 0
                ? `${deletingMember.first_name} ${deletingMember.last_name} still has ${deletingMember.mentee_count} mentee(s) assigned. Removing them will unassign all of those mentees — their mentor field will be set back to "None." This cannot be undone automatically.`
                : `This marks ${deletingMember?.first_name} ${deletingMember?.last_name} as removed. This can be reversed by editing their status back.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
