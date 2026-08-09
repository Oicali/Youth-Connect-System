import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { profileSchema } from "@/lib/validations/profile";
import { fetchProfile, updateProfile } from "@/lib/api/user";
import { useErrorModal } from "@/context/ErrorModalContext";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";

export default function Profile() {
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [account, setAccount] = useState(null); // username, role, status
  const { showError } = useErrorModal();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      first_name: "", last_name: "", middle_name: "", suffix: "",
      email: "", phone: "", alt_phone: "", gender: "", birthdate: "",
    },
  });

  useEffect(() => {
    (async () => {
      try {
        const { user } = await fetchProfile();
        setAccount({ username: user.username, role: user.role_name, status: user.status });
        reset({
          first_name: user.first_name || "",
          last_name: user.last_name || "",
          middle_name: user.middle_name || "",
          suffix: user.suffix || "",
          email: user.email || "",
          phone: user.phone || "",
          alt_phone: user.alt_phone || "",
          gender: user.gender || "",
          birthdate: user.birthdate ? user.birthdate.split("T")[0] : "",
        });
      } catch (err) {
        showError(err.message, "Could Not Load Profile");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onSubmit = async (data) => {
    setSaved(false);
    try {
      await updateProfile(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      showError(err.message, "Could Not Save Profile");
    }
  };

  if (loading) {
    return <p className="text-muted-foreground">Loading profile...</p>;
  }

  const initials = `${watch("first_name")?.[0] || ""}${watch("last_name")?.[0] || ""}`.toUpperCase();

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-4 rounded-xl border bg-card p-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
          {initials || "?"}
        </div>
        <div className="flex-1">
          <p className="text-lg font-semibold">
            {watch("first_name")} {watch("last_name")}
          </p>
          <p className="text-sm text-muted-foreground">@{account?.username}</p>
          <div className="mt-2 flex gap-2">
            <Badge>{account?.role}</Badge>
            <Badge variant="secondary">{account?.status}</Badge>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
        <section className="space-y-4 rounded-xl border bg-card p-6">
          <h2 className="font-semibold">Personal information</h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">First name</Label>
              <Input id="first_name" {...register("first_name")} />
              {errors.first_name && <p className="text-sm text-destructive">{errors.first_name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Last name</Label>
              <Input id="last_name" {...register("last_name")} />
              {errors.last_name && <p className="text-sm text-destructive">{errors.last_name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="middle_name">Middle name</Label>
              <Input id="middle_name" {...register("middle_name")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="suffix">Suffix</Label>
              <Input id="suffix" {...register("suffix")} />
            </div>
            <div className="space-y-2">
              <Label>Gender</Label>
              <Select value={watch("gender")} onValueChange={(v) => setValue("gender", v)}>
                <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
              {errors.gender && <p className="text-sm text-destructive">{errors.gender.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="birthdate">Birthdate</Label>
              <Input id="birthdate" type="date" {...register("birthdate")} />
              {errors.birthdate && <p className="text-sm text-destructive">{errors.birthdate.message}</p>}
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-xl border bg-card p-6">
          <h2 className="font-semibold">Contact information</h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register("email")} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" {...register("phone")} />
              {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="alt_phone">Alternate phone</Label>
              <Input id="alt_phone" {...register("alt_phone")} />
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-xl border bg-card p-6">
          <h2 className="font-semibold">Account security</h2>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Change your account password</p>
            <Button type="button" variant="outline" onClick={() => setPasswordDialogOpen(true)}>
              Change password
            </Button>
          </div>
        </section>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save changes"}
          </Button>
          {saved && <span className="text-sm text-primary">Saved</span>}
        </div>
      </form>

      <ChangePasswordDialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen} />
    </div>
  );
}