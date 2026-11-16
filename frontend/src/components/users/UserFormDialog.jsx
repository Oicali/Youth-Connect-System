// frontend/src/components/UserFormDialog.jsx
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { UserPlus, Pencil } from "lucide-react";

import { addUserSchema, editUserSchema } from "@/lib/validations/user.js";
import { createUser, updateUser } from "@/lib/api/users.js";
import { useErrorModal } from "@/context/ErrorModalContext.jsx";
import { useLoadingModal } from "@/context/LoadingModalContext.jsx";

import { Button } from "@/components/ui/button.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Label } from "@/components/ui/label.jsx";
import { PhoneInput } from "@/components/PhoneInput.jsx"; // fixed 09 prefix, digits only

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select.jsx";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog.jsx";

const emptyDefaults = {
  first_name: "", last_name: "", middle_name: "", suffix: "",
  email: "", phone: "", alt_phone: "", gender: "", role_id: "2", // Volunteer is pre-selected
};

// explicit trigger labels — Radix SelectValue won't resolve text for values set via reset()/setValue()
const ROLE_LABELS = { "1": "Admin", "2": "Volunteer" };
const GENDER_LABELS_FORM = { male: "Male", female: "Female" };



export function UserFormDialog({ user, open, onOpenChange, onSaved }) {
  const isEdit = !!user;
  const { showError } = useErrorModal();
const { runWithLoading } = useLoadingModal();


  const {
    register, handleSubmit, reset, setValue, watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(isEdit ? editUserSchema : addUserSchema),
    defaultValues: emptyDefaults,
  });

  const phoneValue = watch("phone");
  const altPhoneValue = watch("alt_phone");

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
        role_id: String(user.role_id),
      });
    } else {
      reset(emptyDefaults);
    }
  }, [user, open, isEdit, reset]);

  const onSubmit = async (data) => {
    const payload = data;
    try {
      if (isEdit) {
        await runWithLoading("Saving user...", () =>
          updateUser(user.user_id, { ...payload, role_id: Number(payload.role_id) }),
        );
        toast.success("User updated");
      } else {
        let result;
        await runWithLoading("Creating user...", async () => {
          result = await createUser({ ...payload, role_id: Number(payload.role_id) });
        });
        // account exists either way; warn if the welcome email didn't go out
        if (result?.user?.emailSent === false) {
          toast.warning("User created, but the welcome email failed to send. Check the email address.");
        } else {
          toast.success(`User created. Welcome email sent to ${payload.email}`);
        }
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
                {isEdit ? "Update account details and role." : "A welcome email with login details will be sent."}{" "}
                <span className="text-destructive">*</span> required
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
            {/* username + password are generated and emailed, so only the role is chosen here */}
            <div className="space-y-2 sm:col-start-1">
              <Label>Role <span className="text-destructive">*</span></Label>
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
              <Label>First name <span className="text-destructive">*</span></Label>
              <Input maxLength={50} {...register("first_name")} />
              {errors.first_name && <p className="text-sm text-destructive">{errors.first_name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Last name <span className="text-destructive">*</span></Label>
              <Input maxLength={50} {...register("last_name")} />
              {errors.last_name && <p className="text-sm text-destructive">{errors.last_name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Middle name</Label>
              <Input maxLength={50} {...register("middle_name")} />
            </div>
            <div className="space-y-2">
              <Label>Suffix</Label>
              <Input maxLength={10} {...register("suffix")} />
            </div>
            <div className="space-y-2">
              <Label>Gender <span className="text-destructive">*</span></Label>
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


            {/* section: Contact */}
            <div className="mt-2 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground after:h-px after:flex-1 after:bg-border after:content-[''] sm:col-span-3">
              Contact
            </div>
            <div className="space-y-2">
              <Label>Email <span className="text-destructive">*</span></Label>
              <Input type="email" maxLength={255} {...register("email")} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Phone <span className="text-destructive">*</span></Label>
              {/* shouldValidate only once an error is showing, so it doesn't nag mid-typing */}
              <PhoneInput
                value={phoneValue}
                onChange={(v) => setValue("phone", v, { shouldDirty: true, shouldValidate: !!errors.phone })}
                invalid={!!errors.phone}
              />
              {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Alt phone</Label>
              {/* locked until a phone exists; stays editable if it already has a value so it can be cleared */}
              <PhoneInput
                value={altPhoneValue}
                onChange={(v) => setValue("alt_phone", v, { shouldDirty: true, shouldValidate: !!errors.alt_phone })}
                disabled={!phoneValue && !altPhoneValue}
                invalid={!!errors.alt_phone}
              />
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