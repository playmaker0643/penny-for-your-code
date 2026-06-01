import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Terminal, Eye, EyeOff, Camera, Upload, ArrowRight, ArrowLeft, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Country, State, City } from "country-state-city";
import ReCAPTCHA from "react-google-recaptcha";

const RECAPTCHA_SITE_KEY = "6LcIG6EsAAAAAF0qLUoLe9ms9FWdsWjrRnRL2h7O";

const Register = () => {
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      navigate(role === "admin" ? "/admin" : "/student", { replace: true });
    }
  }, [user, role, loading, navigate]);

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    firstName: "",
    secondName: "",
    otherNames: "",
    phone: "",
    dateOfBirth: "",
    email: "",
    avatarFile: null as File | null,
    avatarPreview: null as string | null,
    country: "",
    countryCode: "",
    state: "",
    stateCode: "",
    city: "",
    address: "",
    password: "",
    confirmPassword: "",
  });
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recaptchaRef = useRef<ReCAPTCHA>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be less than 5MB"); return; }
    setForm({ ...form, avatarFile: file, avatarPreview: URL.createObjectURL(file) });
  };

  const countries = Country.getAllCountries();
  const states = form.countryCode ? State.getStatesOfCountry(form.countryCode) : [];
  const cities = form.countryCode && form.stateCode ? City.getCitiesOfState(form.countryCode, form.stateCode) : [];

  // Password validation
  const passChecks = {
    length: form.password.length >= 8,
    upper: /[A-Z]/.test(form.password),
    lower: /[a-z]/.test(form.password),
    number: /[0-9]/.test(form.password),
    symbol: /[^A-Za-z0-9]/.test(form.password),
  };
  const passwordValid = Object.values(passChecks).every(Boolean);

  const validateStep1 = () => {
    if (!form.firstName.trim()) { toast.error("First name is required"); return false; }
    if (!form.secondName.trim()) { toast.error("Second name is required"); return false; }
    if (!form.phone.trim()) { toast.error("Phone number is required"); return false; }
    if (!form.dateOfBirth) { toast.error("Date of birth is required"); return false; }
    if (!form.email.trim()) { toast.error("Email is required"); return false; }
    return true;
  };

  const validateStep2 = () => {
    if (!form.country) { toast.error("Country is required"); return false; }
    if (!form.state) { toast.error("State is required"); return false; }
    if (!form.city) { toast.error("City is required"); return false; }
    if (!form.address.trim()) { toast.error("Address is required"); return false; }
    return true;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2 && validateStep2()) setStep(3);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordValid) { toast.error("Password does not meet requirements"); return; }
    if (form.password !== form.confirmPassword) { toast.error("Passwords do not match"); return; }
    // reCAPTCHA disabled for now
    // if (!captchaToken) { toast.error("Please verify you are not a robot"); return; }

    setIsLoading(true);

    // reCAPTCHA verification disabled for now
    // try {
    //   const { data: captchaResult } = await supabase.functions.invoke("verify-recaptcha", {
    //     body: { token: captchaToken },
    //   });
    //   if (!captchaResult?.success) {
    //     toast.error("reCAPTCHA verification failed. Please try again.");
    //     recaptchaRef.current?.reset();
    //     setCaptchaToken(null);
    //     setIsLoading(false);
    //     return;
    //   }
    // } catch {
    //   toast.error("reCAPTCHA verification failed");
    //   setIsLoading(false);
    //   return;
    // }

    const fullName = [form.firstName, form.secondName, form.otherNames].filter(Boolean).join(" ");

    const { data: signUpData, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: fullName,
          first_name: form.firstName,
          second_name: form.secondName,
          other_names: form.otherNames,
          phone: form.phone,
          date_of_birth: form.dateOfBirth,
          country: form.country,
          state: form.state,
          town: form.city,
          address: form.address,
        },
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      setIsLoading(false);
      toast.error(error.message);
      return;
    }

    const userId = signUpData.user?.id;
    if (userId && form.avatarFile) {
      const ext = form.avatarFile.name.split(".").pop();
      const path = `${userId}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, form.avatarFile, { upsert: true });
      if (!uploadError) {
        const { data: publicData } = supabase.storage.from("avatars").getPublicUrl(path);
        await supabase.from("profiles").update({ avatar_url: publicData.publicUrl } as any).eq("user_id", userId);
      }
    }

    setIsLoading(false);
    toast.success("Account created! You can now sign in.");
    navigate("/login");
  };

  const PassCheck = ({ ok, label }: { ok: boolean; label: string }) => (
    <div className="flex items-center gap-1.5 text-[11px]">
      {ok ? <Check className="h-3 w-3 text-green-500" /> : <X className="h-3 w-3 text-muted-foreground" />}
      <span className={ok ? "text-green-500" : "text-muted-foreground"}>{label}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-background grid-bg flex items-center justify-center p-4">
      <div className="absolute bottom-1/3 right-1/3 w-72 h-72 bg-cyber-purple/5 rounded-full blur-[100px] pointer-events-none" />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md relative z-10">
        <div className="text-center mb-6">
          <Link to="/" className="inline-flex items-center gap-2 mb-4">
            <Terminal className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold font-display neon-text">CodeBreakers</span>
          </Link>
          <h1 className="text-2xl font-bold font-display text-foreground">Create Account</h1>
          <p className="text-sm text-muted-foreground mt-1">Join the CodeBreakers Academy</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold font-mono transition-colors ${
                s === step ? "bg-primary text-primary-foreground" : s < step ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"
              }`}>
                {s < step ? <Check className="h-4 w-4" /> : s}
              </div>
              {s < 3 && <div className={`w-8 h-0.5 ${s < step ? "bg-green-500" : "bg-muted"}`} />}
            </div>
          ))}
        </div>

        <div className="cyber-card rounded-xl p-6">
          <AnimatePresence mode="wait">
            {/* STEP 1: Personal Info */}
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <h3 className="font-bold font-display text-foreground text-sm mb-1">Step 1 — Personal Information</h3>

                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">First Name *</label>
                  <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="First name" required className="bg-muted border-border" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Second Name *</label>
                  <Input value={form.secondName} onChange={(e) => setForm({ ...form, secondName: e.target.value })} placeholder="Second name" required className="bg-muted border-border" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Other Names</label>
                  <Input value={form.otherNames} onChange={(e) => setForm({ ...form, otherNames: e.target.value })} placeholder="Other names (optional)" className="bg-muted border-border" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Email Address *</label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" required className="bg-muted border-border" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Phone Number *</label>
                  <Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+234 800 000 0000" required className="bg-muted border-border" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Date of Birth *</label>
                  <Input type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} required className="bg-muted border-border" />
                </div>

                <Button onClick={handleNext} className="w-full glow-btn bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
                  Next <ArrowRight className="h-4 w-4" />
                </Button>
              </motion.div>
            )}

            {/* STEP 2: Identity Verification */}
            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <h3 className="font-bold font-display text-foreground text-sm mb-1">Step 2 — Identity Verification</h3>

                {/* Avatar upload */}
                <div className="flex justify-center">
                  <button type="button" onClick={() => fileRef.current?.click()} className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-dashed border-primary/40 hover:border-primary transition-colors group">
                    {form.avatarPreview ? (
                      <img src={form.avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-muted flex flex-col items-center justify-center">
                        <Camera className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                        <span className="text-[8px] text-muted-foreground font-mono mt-0.5">Photo</span>
                      </div>
                    )}
                    <div className="absolute bottom-0 right-0 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                      <Upload className="h-3 w-3 text-primary-foreground" />
                    </div>
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Country *</label>
                  <select
                    value={form.countryCode}
                    onChange={(e) => {
                      const c = countries.find((c) => c.isoCode === e.target.value);
                      setForm({ ...form, countryCode: e.target.value, country: c?.name || "", stateCode: "", state: "", city: "" });
                    }}
                    className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground"
                  >
                    <option value="">Select country</option>
                    {countries.map((c) => (
                      <option key={c.isoCode} value={c.isoCode}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">State *</label>
                  <select
                    value={form.stateCode}
                    onChange={(e) => {
                      const s = states.find((s) => s.isoCode === e.target.value);
                      setForm({ ...form, stateCode: e.target.value, state: s?.name || "", city: "" });
                    }}
                    className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground"
                  >
                    <option value="">Select state</option>
                    {states.map((s) => (
                      <option key={s.isoCode} value={s.isoCode}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">City *</label>
                  <select
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground"
                  >
                    <option value="">Select city</option>
                    {cities.map((c, i) => (
                      <option key={`${c.name}-${i}`} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Address *</label>
                  <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Your address" required className="bg-muted border-border" />
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(1)} className="flex-1 gap-2">
                    <ArrowLeft className="h-4 w-4" /> Back
                  </Button>
                  <Button onClick={handleNext} className="flex-1 glow-btn bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
                    Next <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* STEP 3: Create Password */}
            {step === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <form onSubmit={handleRegister} className="space-y-4">
                  <h3 className="font-bold font-display text-foreground text-sm mb-1">Step 3 — Create Password</h3>

                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">Password *</label>
                    <div className="relative">
                      <Input
                        type={showPass ? "text" : "password"}
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        placeholder="••••••••"
                        required
                        className="bg-muted border-border pr-10"
                      />
                      <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {/* Password requirements */}
                    <div className="mt-2 space-y-1">
                      <PassCheck ok={passChecks.length} label="At least 8 characters" />
                      <PassCheck ok={passChecks.upper} label="Uppercase letter (A-Z)" />
                      <PassCheck ok={passChecks.lower} label="Lowercase letter (a-z)" />
                      <PassCheck ok={passChecks.number} label="Number (0-9)" />
                      <PassCheck ok={passChecks.symbol} label="Symbol (!@#$...)" />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">Confirm Password *</label>
                    <div className="relative">
                      <Input
                        type={showConfirm ? "text" : "password"}
                        value={form.confirmPassword}
                        onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                        placeholder="••••••••"
                        required
                        className="bg-muted border-border pr-10"
                      />
                      <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {form.confirmPassword && form.password !== form.confirmPassword && (
                      <p className="text-[11px] text-destructive mt-1">Passwords do not match</p>
                    )}
                  </div>

                  {/* reCAPTCHA - disabled for now */}
                  {/* <div className="flex justify-center">
                    <ReCAPTCHA ref={recaptchaRef} sitekey={RECAPTCHA_SITE_KEY} onChange={(token) => setCaptchaToken(token)} onExpired={() => setCaptchaToken(null)} theme="dark" />
                  </div> */}

                  <div className="flex gap-3">
                    <Button type="button" variant="outline" onClick={() => setStep(2)} className="flex-1 gap-2">
                      <ArrowLeft className="h-4 w-4" /> Back
                    </Button>
                    <Button type="submit" disabled={isLoading || !passwordValid} className="flex-1 glow-btn bg-primary text-primary-foreground hover:bg-primary/90">
                      {isLoading ? "Creating..." : "Create Account"}
                    </Button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          <p className="text-sm text-muted-foreground text-center mt-5">
            Already have an account?{" "}
            <Link to="/login" className="text-primary hover:underline">Sign in</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Register;
