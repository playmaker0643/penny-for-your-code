import { useState, useEffect, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Save, Mail, Hash, Phone, Camera, BookOpen, ClipboardCheck, FileText, MapPin, Calendar, Globe, Home } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import AvatarCropper from "@/components/AvatarCropper";

const StudentProfile = () => {
  const { profile, user } = useAuth();
  const [form, setForm] = useState({ full_name: "", password: "", confirmPassword: "" });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setForm((f) => ({ ...f, full_name: profile.full_name || "" }));
      setAvatarUrl(profile.avatar_url || null);
    }
  }, [profile]);

  const { data: fullProfile } = useQuery({
    queryKey: ["student-full-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.rpc("get_my_profile");
      return Array.isArray(data) && data.length > 0 ? data[0] : null;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["student-profile-stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [enrollments, lessonsCompleted, submissions] = await Promise.all([
        supabase.from("enrollments").select("*", { count: "exact", head: true }).eq("user_id", user!.id),
        supabase.from("lesson_progress").select("*", { count: "exact", head: true }).eq("user_id", user!.id).eq("completed", true),
        supabase.from("exam_submissions").select("*", { count: "exact", head: true }).eq("user_id", user!.id),
      ]);
      return { courses: enrollments.count || 0, lessons: lessonsCompleted.count || 0, submissions: submissions.count || 0 };
    },
  });

  const handleAvatarPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be less than 5MB"); return; }
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const uploadCropped = async (blob: Blob) => {
    if (!user) return;
    setCropSrc(null);
    setUploading(true);
    const path = `${user.id}/avatar.jpg`;
    const { error } = await supabase.storage.from("avatars").upload(path, blob, { upsert: true, contentType: "image/jpeg" });
    if (error) { toast.error("Upload failed"); setUploading(false); return; }
    const { data: publicData } = supabase.storage.from("avatars").getPublicUrl(path);
    const newUrl = publicData.publicUrl + "?t=" + Date.now();
    await supabase.from("profiles").update({ avatar_url: newUrl }).eq("user_id", user.id);
    setAvatarUrl(newUrl);
    setUploading(false);
    toast.success("Photo updated!");
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    // Update name
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: form.full_name } as any)
      .eq("user_id", user.id);

    // Update password if provided
    if (form.password) {
      if (form.password.length < 8) { toast.error("Password must be at least 8 characters"); setSaving(false); return; }
      if (form.password !== form.confirmPassword) { toast.error("Passwords do not match"); setSaving(false); return; }
      const { error: passError } = await supabase.auth.updateUser({ password: form.password });
      if (passError) { toast.error(passError.message); setSaving(false); return; }
    }

    setSaving(false);
    if (error) {
      toast.error("Failed to save profile");
    } else {
      toast.success("Profile saved!");
      setForm((f) => ({ ...f, password: "", confirmPassword: "" }));
    }
  };

  const fp = fullProfile as any;
  const firstChar = profile?.full_name?.charAt(0)?.toUpperCase() || "U";

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Cover + Avatar */}
        <div className="cyber-card rounded-xl overflow-hidden">
          <div className="h-24 bg-gradient-to-r from-primary/40 via-secondary/20 to-accent/10 relative" />
          <div className="px-4 pb-4 -mt-12 relative">
            <button onClick={() => fileRef.current?.click()} className="w-20 h-20 rounded-full overflow-hidden border-4 border-card relative group">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-primary/20 flex items-center justify-center text-primary font-bold text-2xl font-display">{firstChar}</div>
              )}
              <div className="absolute inset-0 bg-background/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="h-5 w-5 text-primary" />
              </div>
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarPick} className="hidden" />
            {cropSrc && <AvatarCropper src={cropSrc} onCancel={() => setCropSrc(null)} onConfirm={uploadCropped} />}
            {uploading && <p className="text-[10px] text-primary font-mono mt-1 animate-pulse">Uploading...</p>}

            <h2 className="text-xl font-bold font-display text-foreground mt-3">{profile?.full_name || "User"}</h2>
            <div className="flex flex-wrap items-center gap-3 mt-1">
              {profile?.registration_number && (
                <span className="flex items-center gap-1 text-xs text-primary font-mono"><Hash className="h-3 w-3" /> {profile.registration_number}</span>
              )}
              <span className="flex items-center gap-1 text-xs text-muted-foreground"><Mail className="h-3 w-3" /> {user?.email}</span>
            </div>

            {/* Full profile details */}
            <div className="mt-3 space-y-1">
              {fp?.phone && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Phone className="h-3 w-3" /> {fp.phone}</p>}
              {fp?.date_of_birth && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Calendar className="h-3 w-3" /> DOB: {new Date(fp.date_of_birth).toLocaleDateString()}</p>}
              {fp?.country && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Globe className="h-3 w-3" /> {[fp.town, fp.state, fp.country].filter(Boolean).join(", ")}</p>}
              {fp?.address && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Home className="h-3 w-3" /> {fp.address}</p>}
            </div>

            <p className="text-[10px] text-muted-foreground font-mono mt-2">
              Member since {fp?.created_at ? new Date(fp.created_at).toLocaleDateString() : "—"}
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="cyber-card rounded-xl p-3 text-center">
            <BookOpen className="h-4 w-4 text-primary mx-auto mb-1" />
            <p className="text-lg font-bold font-display text-foreground">{stats?.courses || 0}</p>
            <p className="text-[9px] text-muted-foreground font-mono">Courses</p>
          </div>
          <div className="cyber-card rounded-xl p-3 text-center">
            <ClipboardCheck className="h-4 w-4 text-secondary mx-auto mb-1" />
            <p className="text-lg font-bold font-display text-foreground">{stats?.lessons || 0}</p>
            <p className="text-[9px] text-muted-foreground font-mono">Lessons</p>
          </div>
          <div className="cyber-card rounded-xl p-3 text-center">
            <FileText className="h-4 w-4 text-accent mx-auto mb-1" />
            <p className="text-lg font-bold font-display text-foreground">{stats?.submissions || 0}</p>
            <p className="text-[9px] text-muted-foreground font-mono">Submitted</p>
          </div>
        </div>

        {/* Edit form — only editable: name, password, pic */}
        <div className="cyber-card rounded-xl p-5 space-y-4">
          <h3 className="font-bold text-foreground font-display text-sm">Edit Profile</h3>

          <div>
            <label className="text-xs text-muted-foreground font-mono block mb-1.5">Full Name</label>
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="bg-muted border-border" />
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-mono block mb-1.5">Email</label>
            <Input value={user?.email || ""} disabled className="bg-muted/50 border-border text-muted-foreground" />
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-mono block mb-1.5">New Password</label>
            <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Leave blank to keep current" className="bg-muted border-border" />
          </div>

          {form.password && (
            <div>
              <label className="text-xs text-muted-foreground font-mono block mb-1.5">Confirm New Password</label>
              <Input type="password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} placeholder="Confirm password" className="bg-muted border-border" />
            </div>
          )}

          <div>
            <label className="text-xs text-muted-foreground font-mono block mb-1.5">Registration Number</label>
            <Input value={profile?.registration_number || ""} disabled className="bg-muted/50 border-border text-muted-foreground" />
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full glow-btn bg-primary text-primary-foreground hover:bg-primary/90 font-mono font-bold gap-2">
            <Save className="h-4 w-4" />
            {saving ? "SAVING..." : "SAVE CHANGES"}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StudentProfile;
