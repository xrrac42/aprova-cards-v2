import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getSession } from "@/lib/auth";
import { AdminLayout } from "./AdminDashboard";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const Customization: React.FC = () => {
  const navigate = useNavigate();
  const session = getSession();

  const [mentors, setMentors] = useState<any[]>([]);
  const [selectedMentor, setSelectedMentor] = useState<any>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [slug, setSlug] = useState("");
  const [password, setPassword] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#6c63ff");
  const [secondaryColor, setSecondaryColor] = useState("#43e97b");
  const [accentColor, setAccentColor] = useState("#ffd166");
  const [kiwifyToken, setKiwifyToken] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!session || session.role !== "admin") {
      navigate("/login");
      return;
    }
    loadMentors();
  }, []);

  const loadMentors = async () => {
    const { data } = await supabase.from("mentors").select("*");
    setMentors(data || []);
  };

  const selectMentor = (mentor: any) => {
    setSelectedMentor(mentor);
    setName(mentor.name);
    setEmail(mentor.email || "");
    setSlug(mentor.slug);
    setPassword(mentor.mentor_password);
    setPrimaryColor(mentor.primary_color);
    setSecondaryColor(mentor.secondary_color);
    setAccentColor(mentor.accent_color || "#ffd166");
    setKiwifyToken(mentor.kiwify_webhook_token || "");
    setCreating(false);
  };

  const startCreating = () => {
    setSelectedMentor(null);
    setName("");
    setEmail("");
    setSlug("");
    setPassword("MENTOR2025");
    setPrimaryColor("#6c63ff");
    setSecondaryColor("#43e97b");
    setAccentColor("#ffd166");
    setKiwifyToken("");
    setCreating(true);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      let logoUrl = selectedMentor?.logo_url || null;

      if (logoFile) {
        const ext = logoFile.name.split(".").pop();
        const filePath = `${selectedMentor?.id || slug || "mentor"}/${Date.now()}.${ext}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("mentor-logos")
          .upload(filePath, logoFile, { upsert: true });

        if (uploadError) {
          toast.error(`Erro no upload da logo: ${uploadError.message}`);
          setLoading(false);
          return;
        }

        const { data: urlData } = supabase.storage
          .from("mentor-logos")
          .getPublicUrl(uploadData.path);
        logoUrl = urlData.publicUrl;
      }

      const mentorData = {
        name,
        email: email || null,
        slug,
        mentor_password: password,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        accent_color: accentColor,
        kiwify_webhook_token: kiwifyToken || null,
        logo_url: logoUrl,
      };

      if (creating) {
        const { error } = await supabase.from("mentors").insert(mentorData);
        if (error) throw error;
        toast.success("Mentor criado com sucesso!");
      } else if (selectedMentor) {
        const backendURL =
          import.meta.env.VITE_BACKEND_URL || "http://localhost:8080";
        const updatePayload = {
          name,
          email: email || null,
          slug,
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          logo_url: logoUrl,
        };
        const res = await fetch(
          `${backendURL}/api/v1/admin/mentors/${selectedMentor.id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatePayload),
          },
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Erro ao atualizar mentor");
        }
        toast.success("Mentor atualizado com sucesso!");
      }

      setLogoFile(null);
      setCreating(false);

      // Recarregar dados frescos do banco
      const { data: freshMentors } = await supabase.from("mentors").select("*");
      setMentors(freshMentors || []);

      // Atualizar o mentor selecionado com dados frescos
      if (selectedMentor) {
        const updated = (freshMentors || []).find(
          (m: any) => m.id === selectedMentor.id,
        );
        if (updated) selectMentor(updated);
      }
    } catch (err: any) {
      toast.error(`Erro ao salvar: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="p-4 md:p-8">
        <div className="mx-auto max-w-3xl">
          <h1 className="mb-6 font-display text-2xl font-bold text-foreground">
            Personalização Visual
          </h1>

          <div className="mb-6 flex flex-wrap gap-2">
            {mentors.map((m) => (
              <button
                key={m.id}
                onClick={() => selectMentor(m)}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${selectedMentor?.id === m.id ? "bg-primary text-primary-foreground" : "border border-border bg-card text-foreground hover:bg-surface-hover"}`}
              >
                {m.name}
              </button>
            ))}
            <button
              onClick={startCreating}
              className="rounded-xl border border-dashed border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              + Novo Mentor
            </button>
          </div>

          {(creating || selectedMentor) && (
            <div className="grid gap-6 md:grid-cols-2">
              {/* Form */}
              <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Nome
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    E-mail do Mentor
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="mentor@email.com"
                    className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Slug (URL)
                  </label>
                  <input
                    value={slug}
                    onChange={(e) => {
                      const val = e.target.value
                        .toLowerCase()
                        .replace(/ç/g, "c")
                        .normalize("NFD")
                        .replace(/[\u0300-\u036f]/g, "")
                        .replace(/[^a-z0-9\s-]/g, "")
                        .replace(/\s+/g, "-")
                        .replace(/-+/g, "-")
                        .trim();
                      setSlug(val);
                    }}
                    className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-foreground font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Senha do Mentor
                  </label>
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-foreground font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Cor Primária
                  </label>
                  <div className="flex gap-3 items-center">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="h-10 w-14 rounded-lg border-none cursor-pointer"
                    />
                    <span className="font-mono text-sm text-muted-foreground">
                      {primaryColor}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Cor Secundária
                  </label>
                  <div className="flex gap-3 items-center">
                    <input
                      type="color"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="h-10 w-14 rounded-lg border-none cursor-pointer"
                    />
                    <span className="font-mono text-sm text-muted-foreground">
                      {secondaryColor}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Cor de Destaque
                  </label>
                  <p className="mb-1.5 text-xs text-muted-foreground">
                    Usada em botões de ação, badges e elementos interativos
                  </p>
                  <div className="flex gap-3 items-center">
                    <input
                      type="color"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="h-10 w-14 rounded-lg border-none cursor-pointer"
                    />
                    <span className="font-mono text-sm text-muted-foreground">
                      {accentColor}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Logo
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                    className="w-full text-sm text-muted-foreground file:mr-4 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground file:cursor-pointer"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Token Webhook Kiwify
                  </label>
                  <input
                    value={kiwifyToken}
                    onChange={(e) => setKiwifyToken(e.target.value)}
                    placeholder="Cole aqui o token do webhook"
                    className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-foreground font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Após criar o webhook na Kiwify (Apps → Webhooks), copie o
                    token gerado e cole aqui
                  </p>
                </div>
                <button
                  onClick={handleSave}
                  disabled={loading || !name || !slug || !password}
                  className="w-full rounded-xl bg-primary py-3 font-display font-semibold text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Salvar Tema
                </button>
              </div>

              {/* Preview */}
              <div className="space-y-4">
                <h3 className="font-display font-semibold text-foreground">
                  Preview
                </h3>
                <div
                  className="rounded-2xl border border-border p-6"
                  style={{ background: "#0a0a0f" }}
                >
                  <div className="flex flex-col items-center gap-4">
                    <div
                      className="h-12 w-12 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: primaryColor + "20" }}
                    >
                      <span
                        className="font-display text-xl font-bold"
                        style={{ color: primaryColor }}
                      >
                        {name?.charAt(0) || "M"}
                      </span>
                    </div>
                    <p className="font-display font-bold text-foreground">
                      {name || "Mentor"}
                    </p>
                    <div className="w-full space-y-2">
                      <div className="h-10 w-full rounded-xl border border-border bg-surface" />
                      <div className="h-10 w-full rounded-xl border border-border bg-surface" />
                      <div
                        className="h-10 w-full rounded-xl"
                        style={{ backgroundColor: primaryColor }}
                      />
                    </div>
                  </div>
                  <div className="mt-6">
                    <div className="h-2 w-full rounded-full bg-surface">
                      <div
                        className="h-2 rounded-full w-3/4"
                        style={{
                          background: `linear-gradient(90deg, ${primaryColor}, ${secondaryColor})`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-4 gap-2">
                    <div
                      className="rounded-lg py-2 text-center text-xs font-medium"
                      style={{ backgroundColor: "#dc262620", color: "#dc2626" }}
                    >
                      Errei
                    </div>
                    <div
                      className="rounded-lg py-2 text-center text-xs font-medium"
                      style={{ backgroundColor: "#f9731620", color: "#f97316" }}
                    >
                      Difícil
                    </div>
                    <div
                      className="rounded-lg py-2 text-center text-xs font-medium"
                      style={{
                        backgroundColor: secondaryColor + "20",
                        color: secondaryColor,
                      }}
                    >
                      Médio
                    </div>
                    <div
                      className="rounded-lg py-2 text-center text-xs font-medium"
                      style={{
                        backgroundColor: primaryColor + "20",
                        color: primaryColor,
                      }}
                    >
                      Fácil
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default Customization;
