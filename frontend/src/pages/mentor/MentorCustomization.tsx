import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getSession } from "@/lib/auth";
import { applyMentorTheme } from "@/lib/theme";
import { ArrowLeft, Upload, Loader2 } from "lucide-react";
import ColorPicker from "@/components/ColorPicker";

const MentorCustomization: React.FC = () => {
  const navigate = useNavigate();
  const session = getSession();

  const [mentor, setMentor] = useState<any>(null);
  const [primaryColor, setPrimaryColor] = useState("#6c63ff");
  const [secondaryColor, setSecondaryColor] = useState("#43e97b");
  const [accentColor, setAccentColor] = useState("#ffd166");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!session || session.role !== "mentor" || !session.mentor_id) {
      navigate("/login");
      return;
    }
    loadMentor();
  }, []);

  const loadMentor = async () => {
    const { data } = await supabase
      .from("mentors")
      .select("*")
      .eq("id", session!.mentor_id)
      .maybeSingle();
    if (data) {
      setMentor(data);
      setPrimaryColor(data.primary_color);
      setSecondaryColor(data.secondary_color);
      setAccentColor((data as any).accent_color || "#ffd166");
      applyMentorTheme(
        data.primary_color,
        data.secondary_color,
        (data as any).accent_color,
      );
    }
  };

  // Live preview
  useEffect(() => {
    applyMentorTheme(primaryColor, secondaryColor, accentColor);
  }, [primaryColor, secondaryColor, accentColor]);

  const handleSave = async () => {
    if (!mentor) return;
    setLoading(true);
    setSaved(false);

    let logoUrl = mentor.logo_url;
    if (logoFile) {
      const ext = logoFile.name.split(".").pop();
      const path = `${mentor.slug}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("mentor-logos")
        .upload(path, logoFile);
      if (uploadError) {
        setLoading(false);
        alert(`Falha ao enviar a logo: ${uploadError.message}`);
        return;
      }
      const { data: urlData } = supabase.storage
        .from("mentor-logos")
        .getPublicUrl(path);
      logoUrl = urlData.publicUrl;
    }

    const { error: updateError } = await supabase
      .from("mentors")
      .update({
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        accent_color: accentColor,
        logo_url: logoUrl,
      })
      .eq("id", mentor.id);

    if (updateError) {
      setLoading(false);
      alert(`Erro ao salvar: ${updateError.message}`);
      return;
    }

    setLoading(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const mentorName = mentor?.name || "Mentor";

  return (
    <div className="min-h-screen bg-background px-4 pb-8 pt-6">
      <div className="mx-auto max-w-3xl">
        <Link
          to="/mentor"
          className="mb-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar ao painel
        </Link>

        <h1 className="mb-6 font-display text-2xl font-bold text-foreground">
          Personalização Visual
        </h1>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Form */}
          <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
            <ColorPicker
              label="Cor Primária"
              value={primaryColor}
              onChange={setPrimaryColor}
            />
            <ColorPicker
              label="Cor Secundária"
              value={secondaryColor}
              onChange={setSecondaryColor}
            />
            <ColorPicker
              label="Cor de Destaque"
              value={accentColor}
              onChange={setAccentColor}
              description="Usada em botões de ação, badges e elementos interativos"
            />
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
            <button
              onClick={handleSave}
              disabled={loading}
              className="w-full rounded-xl bg-primary py-3 font-display font-semibold text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {saved ? "✓ Salvo!" : "Salvar Tema"}
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
              {/* Login preview */}
              <div className="flex flex-col items-center gap-4">
                <div
                  className="h-12 w-12 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: primaryColor + "20" }}
                >
                  <span
                    className="font-display text-xl font-bold"
                    style={{ color: primaryColor }}
                  >
                    {mentorName.charAt(0)}
                  </span>
                </div>
                <p className="font-display font-bold text-foreground">
                  {mentorName}
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

              {/* Progress bar preview */}
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

              {/* Button previews */}
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
      </div>
    </div>
  );
};

export default MentorCustomization;
