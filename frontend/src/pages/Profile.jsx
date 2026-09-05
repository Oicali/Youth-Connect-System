// frontend\src\pages\Profile.jsx

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Pencil, X, Camera, Lock } from "lucide-react";

import { profileSchema } from "@/lib/validations/user";
import { updateProfile } from "@/lib/api/profile";
import { useAuth } from "@/context/AuthContext";
import { useErrorModal } from "@/context/ErrorModalContext";
import { useLoadingModal } from "@/context/LoadingModalContext";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/context/ThemeContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format, parse } from "date-fns";

const emptyValues = {
  first_name: "",
  last_name: "",
  middle_name: "",
  suffix: "",
  email: "",
  phone: "",
  alt_phone: "",
  gender: "",
  birthdate: "",
};

export default function Profile() {
  const { theme, toggleTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [account, setAccount] = useState(null);
  const [savedValues, setSavedValues] = useState(emptyValues);
  const { showError } = useErrorModal();
  const { runWithLoading } = useLoadingModal();
  const { user: authUser, refetch } = useAuth();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: emptyValues,
    mode: "onSubmit",
    reValidateMode: "onSubmit",
  });

  useEffect(() => {
  if (!authUser) return;
  setAccount({
    username: authUser.username,
    role: authUser.role_name,
    status: authUser.status,
  });
  const values = {
    first_name: authUser.first_name || "",
    last_name: authUser.last_name || "",
    middle_name: authUser.middle_name || "",
    suffix: authUser.suffix || "",
    email: authUser.email || "",
    phone: authUser.phone || "",
    alt_phone: authUser.alt_phone || "",
    gender: authUser.gender || "",
    birthdate: authUser.birthdate ? authUser.birthdate.split("T")[0] : "",
  };
  setSavedValues(values);
  reset(values);
  setLoading(false);
}, [authUser]);

  const onSubmit = async (data) => {
  try {
    await runWithLoading("Saving profile...", () => updateProfile(data));
    setSavedValues(data);
    setIsEditing(false);
    toast.success("Profile updated");
    refetch();
  } catch (err) {
    if (err.field) {
      setError(err.field, { message: err.message });
    } else {
      showError(err.message, "Could Not Save Profile");
    }
  }
};

  const handleCancel = () => {
    reset(savedValues);
    setIsEditing(false);
  };

  if (loading) {
    return <p className="text-muted-foreground">Loading profile...</p>;
  }

  const initials =
    `${watch("first_name")?.[0] || ""}${watch("last_name")?.[0] || ""}`.toUpperCase();

  const middleInitial = watch("middle_name")
    ? `${watch("middle_name")[0]}.`
    : "";
  const restOfName = [middleInitial, watch("last_name"), watch("suffix")]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 justify-between ">
        <div>
          <h1 className="text-2xl font-bold">My Profile</h1>
          <p className="text-sm text-muted-foreground">
            Manage your personal information and account settings
          </p>
        </div>

        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button type="button" variant="outline" onClick={handleCancel}>
                <X size={16} className="" />
                Cancel
              </Button>
              <Button type="submit" form="profile-form" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save changes"}
              </Button>
            </>
          ) : (
            <Button type="button" onClick={() => setIsEditing(true)}>
              <Pencil size={16} className="mr-2" />
              Edit profile
            </Button>
          )}
        </div>
      </div>

      <form id="profile-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[280px_1fr]">
          {/* Left column — identity card + theme toggle */}
          <div className="space-y-4">
            <div className="h-fit space-y-5 rounded-xl border bg-card p-8 text-center">
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-primary text-2xl font-semibold text-primary-foreground">
                {initials || "?"}
              </div>
              <div className="space-y-1 px-2">
                <div className="flex min-w-0 flex-wrap items-baseline justify-center gap-x-1">
                  <span
                    className="max-w-full truncate text-lg font-semibold"
                    title={watch("first_name")}
                  >
                    {watch("first_name")}
                  </span>
                  {restOfName && (
                    <span
                      className="max-w-full truncate text-lg font-semibold"
                      title={restOfName}
                    >
                      {restOfName}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  @{account?.username}
                </p>
              </div>
              <div className="flex justify-center gap-2">
                <Badge
                  variant={account?.role === "admin" ? "default" : "secondary"}
                  className="capitalize"
                >
                  {account?.role}
                </Badge>
                <Badge
                  variant={
                    account?.status === "active" ? "success" : "destructive"
                  }
                  className="capitalize"
                >
                  {account?.status}
                </Badge>
              </div>
              <div className="space-y-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => toast.info("Photo upload coming soon")}
                >
                  <Camera size={16} className="mr-2" />
                  Update photo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setPasswordDialogOpen(true)}
                >
                  <Lock size={16} className="mr-2" />
                  Change password
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border bg-card p-5">
              <div>
                <p className="text-sm font-medium">Dark mode</p>
                <p className="text-xs text-muted-foreground">Switch theme</p>
              </div>
              <Switch
                checked={theme === "dark"}
                onCheckedChange={toggleTheme}
              />
            </div>
          </div>

          {/* Right — editable fields */}
          <div className="space-y-6 rounded-xl border bg-card p-6">
            <div>
              <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Personal information
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="first_name"
                    className="text-xs text-muted-foreground"
                  >
                    First name
                  </Label>
                  <Input
                    id="first_name"
                    maxLength={50}
                    disabled={!isEditing}
                    {...register("first_name")}
                  />
                  {errors.first_name && (
                    <p className="text-sm text-destructive">
                      {errors.first_name.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="last_name"
                    className="text-xs text-muted-foreground"
                  >
                    Last name
                  </Label>
                  <Input
                    id="last_name"
                    maxLength={50}
                    disabled={!isEditing}
                    {...register("last_name")}
                  />
                  {errors.last_name && (
                    <p className="text-sm text-destructive">
                      {errors.last_name.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="middle_name"
                    className="text-xs text-muted-foreground"
                  >
                    Middle name
                  </Label>
                  <Input
                    id="middle_name"
                    maxLength={50}
                    disabled={!isEditing}
                    {...register("middle_name")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="suffix"
                    className="text-xs text-muted-foreground"
                  >
                    Suffix
                  </Label>
                  <Input
                    id="suffix"
                    maxLength={10}
                    disabled={!isEditing}
                    {...register("suffix")}
                  />
                </div>
                <div className="flex gap-3">
                  <div className="flex-3 space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Gender
                    </Label>
                    <Select
                      value={watch("gender")}
                      onValueChange={(v) => setValue("gender", v)}
                      disabled={!isEditing}
                    >
                      <SelectTrigger className="w-full capitalize">
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male" className="capitalize">
                          Male
                        </SelectItem>
                        <SelectItem value="female" className="capitalize">
                          Female
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.gender && (
                      <p className="text-sm text-destructive">
                        {errors.gender.message}
                      </p>
                    )}
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Birthdate
                    </Label>
                    <Popover
                      open={isEditing && datePopoverOpen}
                      onOpenChange={(open) =>
                        isEditing && setDatePopoverOpen(open)
                      }
                    >
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={!isEditing}
                          className={`flex h-9 w-full items-center justify-start rounded-md border border-input bg-transparent px-3 font-normal shadow-xs hover:bg-transparent dark:bg-input/30 ${
                            !isEditing ? "pointer-events-none opacity-50" : ""
                          }`}
                        >
                          <CalendarIcon
                            size={16}
                            className="mr-2 shrink-0 text-muted-foreground"
                          />
                          <span className="truncate">
                            {watch("birthdate")
                              ? format(
                                  parse(
                                    watch("birthdate"),
                                    "yyyy-MM-dd",
                                    new Date(),
                                  ),
                                  "MMMM d, yyyy",
                                )
                              : "Select date"}
                          </span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={
                            watch("birthdate")
                              ? parse(
                                  watch("birthdate"),
                                  "yyyy-MM-dd",
                                  new Date(),
                                )
                              : undefined
                          }
                          onSelect={(date) => {
                            if (date)
                              setValue("birthdate", format(date, "yyyy-MM-dd"));
                            setDatePopoverOpen(false);
                          }}
                          captionLayout="dropdown"
                          fromYear={1950}
                          toYear={new Date().getFullYear() - 16}
                          disabled={{
                            after: new Date(
                              new Date().setFullYear(
                                new Date().getFullYear() - 16,
                              ),
                            ),
                          }}
                          defaultMonth={
                            watch("birthdate")
                              ? parse(
                                  watch("birthdate"),
                                  "yyyy-MM-dd",
                                  new Date(),
                                )
                              : new Date(
                                  new Date().setFullYear(
                                    new Date().getFullYear() - 16,
                                  ),
                                )
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    {errors.birthdate && (
                      <p className="text-sm text-destructive">
                        {errors.birthdate.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Contact information
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1.5">
                  <Label
                    htmlFor="email"
                    className="text-xs text-muted-foreground"
                    
                  >
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    maxLength={255}
                    disabled={!isEditing}
                    {...register("email")}
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive">
                      {errors.email.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="phone"
                    className="text-xs text-muted-foreground"
                  >
                    Phone
                  </Label>
                  <Input
                    id="phone"
                    inputMode="numeric"
                    maxLength={11}
                    disabled={!isEditing}
                    {...register("phone")}
                    onInput={(e) => {
                      e.target.value = e.target.value.replace(/\D/g, "").slice(0, 11);
                    }}
                  />
                  {errors.phone && (
                    <p className="text-sm text-destructive">
                      {errors.phone.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="alt_phone"
                    className="text-xs text-muted-foreground"
                  >
                    Alternate phone
                  </Label>
                  <Input
                    id="alt_phone"
                    inputMode="numeric"
                    maxLength={11}
                    disabled={!isEditing}
                    {...register("alt_phone")}
                    onInput={(e) => {
                      e.target.value = e.target.value.replace(/\D/g, "").slice(0, 11);
                    }}
                  />
                  {errors.alt_phone && (
                    <p className="text-sm text-destructive">
                      {errors.alt_phone.message}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>

      <ChangePasswordDialog
        open={passwordDialogOpen}
        onOpenChange={setPasswordDialogOpen}
      />
    </div>
  );
}