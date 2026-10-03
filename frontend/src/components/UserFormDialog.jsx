// frontend/src/components/UserFormDialog.jsx
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { format, parse } from "date-fns";
import { UserPlus, Pencil, Calendar as CalendarIcon } from "lucide-react";

import { addUserSchema, editUserSchema } from "@/lib/validations/user";
import { createUser, updateUser } from "@/lib/api/users";
import { useErrorModal } from "@/context/ErrorModalContext";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

const emptyDefaults = {
  username: "", password: "", confirmPassword: "",
  first_name: "", last_name: "", middle_name: "", suffix: "",
  email: "", phone: "", alt_phone: "", gender: "", birthdate: "", role_id: "",
};

// explicit trigger labels — Radix SelectValue won't resolve text for values set via reset()/setValue()
const ROLE_LABELS = { "1": "Admin", "2": "Volunteer" };
const GENDER_LABELS_FORM = { male: "Male", female: "Female" };

export function UserFormDialog({ user, open, onOpenChange, onSaved }) {
  const isEdit = !!user;
  const { showError } = useErrorModal();
  const [birthOpen, setBirthOpen] = useState(false); // birthdate popover

  const {
    register, handleSubmit, reset, setValue, watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(isEdit ? editUserSchema : addUserSchema),
    defaultValues: emptyDefaults,
  });

  // Re-populate whenever the target user or open-state changes, so switching
  // between "add" and "edit" (or between two different users) always starts clean.
  useEffect(() => {
    if (!open) return;
    if (isEdit) {
      reset({
        ...emptyDefaults,
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        middle_name: user.middle_name || "",
        suffix: user.suffix || "",
        email: user.email || "",
        phone: user.phone || "",
        alt_phone: user.alt_phone || "",
        gender: user.gender || "",
        birthdate: user.birthdate ? user.birthdate.split("T")[0] : "",
        role_id: String(user.role_id),
      });
    } else {
      reset(emptyDefaults);
    }
  }, [user, open, isEdit, reset]);

  const onSubmit = async (data) => {
    const { confirmPassword, ...payload } = data;
    try {
      if (isEdit) {
        await updateUser(user.user_id, { ...payload, role_id: Number(payload.role_id) });
        toast.success("User updated");
      } else {
        await createUser({ ...payload, role_id: Number(payload.role_id) });
        toast.success("User created");
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      showError(err.message, isEdit ? "Could Not Update User" : "Could Not Create User");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* p-0 + flex-col: header and footer are pinned bars, only the form body scrolls */}
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[820px]">
        <DialogHeader className="border-b border-border px-5 py-5">
          <div className="flex items-start gap-4">
            {/* icon badge: primary-tinted circle, icon matches the Add / Edit buttons */}
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              {isEdit ? <Pencil size={18} className="text-primary" /> : <UserPlus size={18} className="text-primary" />}
            </div>
            <div className="space-y-1.5 text-left">
              <DialogTitle>{isEdit ? `Edit User` : "Add New User"}</DialogTitle>
              <DialogDescription>
                {isEdit ? "Update account details and role." : "Create an account for an admin or volunteer."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col" noValidate>
          {/* scrollable body: 1 column on mobile, 3 columns on sm+ */}
          <div className="grid flex-1 grid-cols-1 content-start gap-4 overflow-y-auto px-7 py-5 sm:grid-cols-3">
            {/* section: Account */}
            <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground after:h-px after:flex-1 after:bg-border after:content-[''] sm:col-span-3">
              Account
            </div>
            {/* username + passwords only exist when creating a user */}
            {!isEdit && (
              <>
                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input {...register("username")} />
                  {errors.username && <p className="text-sm text-destructive">{errors.username.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input type="password" {...register("password")} />
                  {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Confirm password</Label>
                  <Input type="password" {...register("confirmPassword")} />
                  {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>}
                </div>
              </>
            )}
            <div className="space-y-2 sm:col-start-1">
              <Label>Role</Label>
              <Select value={watch("role_id")} onValueChange={(v) => setValue("role_id", v, { shouldValidate: true })}>
                <SelectTrigger className="w-full"> {/* fill the grid cell like the inputs */}
                  <SelectValue placeholder="Select role">{ROLE_LABELS[watch("role_id")]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Admin</SelectItem>
                  <SelectItem value="2">Volunteer</SelectItem>
                </SelectContent>
              </Select>
              {errors.role_id && <p className="text-sm text-destructive">{errors.role_id.message}</p>}
            </div>

            {/* section: Personal */}
            <div className="mt-2 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground after:h-px after:flex-1 after:bg-border after:content-[''] sm:col-span-3">
              Personal
            </div>
            <div className="space-y-2">
              <Label>First name</Label>
              <Input {...register("first_name")} />
              {errors.first_name && <p className="text-sm text-destructive">{errors.first_name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Last name</Label>
              <Input {...register("last_name")} />
              {errors.last_name && <p className="text-sm text-destructive">{errors.last_name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Middle name</Label>
              <Input {...register("middle_name")} />
            </div>
            <div className="space-y-2">
              <Label>Suffix</Label>
              <Input {...register("suffix")} />
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
              <Label>Birthdate</Label>
              {/* same picker as the member modals */}
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
                    {watch("birthdate")
                      ? format(parse(watch("birthdate"), "yyyy-MM-dd", new Date()), "MMMM d, yyyy")
                      : "Select date"}
                  </span>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={watch("birthdate") ? parse(watch("birthdate"), "yyyy-MM-dd", new Date()) : undefined}
                    onSelect={(date) => {
                      if (date) setValue("birthdate", format(date, "yyyy-MM-dd"), { shouldDirty: true, shouldValidate: true });
                      setBirthOpen(false);
                    }}
                    captionLayout="dropdown"
                    fromYear={1950}
                    toYear={new Date().getFullYear()}
                    disabled={{ after: new Date() }}
                    defaultMonth={watch("birthdate") ? parse(watch("birthdate"), "yyyy-MM-dd", new Date()) : undefined}
                  />
                </PopoverContent>
              </Popover>
              {errors.birthdate && <p className="text-sm text-destructive">{errors.birthdate.message}</p>}
            </div>

            {/* section: Contact */}
            <div className="mt-2 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground after:h-px after:flex-1 after:bg-border after:content-[''] sm:col-span-3">
              Contact
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" {...register("email")} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input placeholder="09XX XXX XXXX" {...register("phone")} />
              {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Alt phone</Label>
              <Input {...register("alt_phone")} />
              {errors.alt_phone && <p className="text-sm text-destructive">{errors.alt_phone.message}</p>}
            </div>
          </div>

          {/* pinned footer bar, outside the scrolling body */}
          <DialogFooter className="border-t bg-muted/30 px-7 py-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? (isEdit ? "Saving..." : "Creating...")
                : (isEdit ? "Save changes" : "Create user")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}