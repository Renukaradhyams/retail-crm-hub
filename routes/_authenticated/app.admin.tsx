import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_LABELS } from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/app/admin")({
  component: AdminPage,
});

function AdminPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"company" | "sections" | "questions" | "people">("company");
  const [company, setCompany] = useState({
    company_name: "",
    logo_url: "",
    open_hour: "10",
    close_hour: "22",
    footfall_grace_minutes: "30",
    edit_cutoff_hours: "3",
    der_email: "",
    der_whatsapp_note: "",
  });
  const [newSection, setNewSection] = useState({ name: "", section_type: "floor", manager: "" });
  const [newQuestion, setNewQuestion] = useState("");

  const { data } = useQuery({
    queryKey: ["admin"],
    queryFn: async () => {
      const [settings, sections, questions, profiles, roles] = await Promise.all([
        supabase.from("settings").select("*").maybeSingle(),
        supabase.from("sections").select("*").order("name"),
        supabase.from("feedback_questions").select("*").order("position"),
        supabase.from("profiles").select("id, full_name, email, is_active"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      return {
        settings: settings.data,
        sections: sections.data ?? [],
        questions: questions.data ?? [],
        profiles: profiles.data ?? [],
        roles: roles.data ?? [],
      };
    },
  });

  useEffect(() => {
    if (!data?.settings) return;
    const s = data.settings;
    setCompany({
      company_name: s.company_name,
      logo_url: s.logo_url ?? "",
      open_hour: String(s.open_hour),
      close_hour: String(s.close_hour),
      footfall_grace_minutes: String(s.footfall_grace_minutes),
      edit_cutoff_hours: String(s.edit_cutoff_hours),
      der_email: s.der_email ?? "",
      der_whatsapp_note: s.der_whatsapp_note ?? "",
    });
  }, [data]);

  async function saveCompany() {
    const { error } = await supabase
      .from("settings")
      .update({
        company_name: company.company_name.trim() || "BSC Retail",
        logo_url: company.logo_url.trim() || null,
        open_hour: Number(company.open_hour) || 10,
        close_hour: Number(company.close_hour) || 22,
        footfall_grace_minutes: Number(company.footfall_grace_minutes) || 30,
        edit_cutoff_hours: Number(company.edit_cutoff_hours) || 3,
        der_email: company.der_email.trim() || null,
        der_whatsapp_note: company.der_whatsapp_note.trim() || null,
        setup_complete: true,
      })
      .eq("id", true);
    if (error) return toast.error(error.message);
    toast.success("Settings saved");
    queryClient.invalidateQueries();
  }

  async function addSection() {
    if (!newSection.name.trim()) return toast.error("Section name is required");
    const { error } = await supabase.from("sections").insert({
      name: newSection.name.trim(),
      section_type: newSection.section_type,
      manager: newSection.manager.trim() || null,
    });
    if (error) return toast.error(error.message);
    setNewSection({ name: "", section_type: "floor", manager: "" });
    queryClient.invalidateQueries({ queryKey: ["admin"] });
  }

  async function addQuestion() {
    if (!newQuestion.trim()) return toast.error("Question text is required");
    const { error } = await supabase.from("feedback_questions").insert({
      question: newQuestion.trim(),
      position: (data?.questions.length ?? 0) + 1,
    });
    if (error) return toast.error(error.message);
    setNewQuestion("");
    queryClient.invalidateQueries({ queryKey: ["admin"] });
  }

  const rolesByUser = new Map<string, string[]>();
  (data?.roles ?? []).forEach((row) => {
    rolesByUser.set(row.user_id, [...(rolesByUser.get(row.user_id) ?? []), ROLE_LABELS[row.role]]);
  });

  const tabs = [
    ["company", "Company"],
    ["sections", "Sections"],
    ["questions", "Questions"],
    ["people", "People"],
  ] as const;

  return (
    <>
      <PageHeader
        title="Admin Settings"
        subtitle="Company configuration, store sections, feedback questions and staff."
        actions={
          <div className="flex flex-wrap gap-2">
            {tabs.map(([key, label]) => (
              <Button
                key={key}
                variant={tab === key ? "default" : "secondary"}
                onClick={() => setTab(key)}
              >
                {label}
              </Button>
            ))}
          </div>
        }
      />

      {tab === "company" && (
        <div className="panel grid gap-4 p-6 sm:grid-cols-2">
          {(
            [
              ["company_name", "Company name", "text"],
              ["logo_url", "Logo URL", "text"],
              ["open_hour", "Opening hour (0-23)", "number"],
              ["close_hour", "Closing hour (0-23)", "number"],
              ["footfall_grace_minutes", "Footfall grace (minutes)", "number"],
              ["edit_cutoff_hours", "Slot edit cutoff (hours)", "number"],
              ["der_email", "DER email", "text"],
              ["der_whatsapp_note", "DER WhatsApp note", "text"],
            ] as const
          ).map(([key, label, type]) => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={key}>{label}</Label>
              <Input
                id={key}
                type={type}
                value={company[key]}
                onChange={(e) => setCompany({ ...company, [key]: e.target.value })}
              />
            </div>
          ))}
          <div className="sm:col-span-2">
            <Button onClick={saveCompany}>
              <Save className="mr-2 h-4 w-4" /> Save settings
            </Button>
          </div>
          <div className="sm:col-span-2">
            <DevicePins />
          </div>
        </div>
      )}


      {tab === "sections" && (
        <div className="space-y-4">
          <div className="panel flex flex-wrap items-end gap-3 p-5">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={newSection.name}
                onChange={(e) => setNewSection({ ...newSection, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <select
                value={newSection.section_type}
                onChange={(e) => setNewSection({ ...newSection, section_type: e.target.value })}
                className="h-10 rounded-md border border-input bg-card px-3 text-sm"
              >
                <option value="floor">Floor</option>
                <option value="counter">Counter</option>
                <option value="service">Service</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Manager</Label>
              <Input
                value={newSection.manager}
                onChange={(e) => setNewSection({ ...newSection, manager: e.target.value })}
              />
            </div>
            <Button onClick={addSection}>
              <Plus className="mr-2 h-4 w-4" /> Add
            </Button>
          </div>
          <div className="panel divide-y divide-border">
            {(data?.sections ?? []).map((section) => (
              <div key={section.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1">
                  <p className="font-medium">{section.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {section.section_type} · {section.manager ?? "no manager"}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={async () => {
                    await supabase.from("sections").delete().eq("id", section.id);
                    queryClient.invalidateQueries({ queryKey: ["admin"] });
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "questions" && (
        <div className="space-y-4">
          <div className="panel flex flex-wrap items-end gap-3 p-5">
            <div className="flex-1 space-y-1.5">
              <Label>New question</Label>
              <Input value={newQuestion} onChange={(e) => setNewQuestion(e.target.value)} maxLength={200} />
            </div>
            <Button onClick={addQuestion}>
              <Plus className="mr-2 h-4 w-4" /> Add
            </Button>
          </div>
          <div className="panel divide-y divide-border">
            {(data?.questions ?? []).map((question) => (
              <div key={question.id} className="flex items-center gap-3 px-5 py-3">
                <span className="num text-xs text-muted-foreground">Q{question.position}</span>
                <p className="flex-1">{question.question}</p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    await supabase
                      .from("feedback_questions")
                      .update({ is_active: !question.is_active })
                      .eq("id", question.id);
                    queryClient.invalidateQueries({ queryKey: ["admin"] });
                  }}
                >
                  {question.is_active ? "Deactivate" : "Activate"}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "people" && (
        <div className="panel divide-y divide-border">
          {(data?.profiles ?? []).map((profile) => (
            <div key={profile.id} className="flex items-center gap-3 px-5 py-3">
              <div className="flex-1">
                <p className="font-medium">{profile.full_name || profile.email}</p>
                <p className="text-xs text-muted-foreground">
                  {rolesByUser.get(profile.id)?.join(", ") || "No role"} ·{" "}
                  {profile.is_active ? "Active" : "Inactive"}
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  await supabase
                    .from("profiles")
                    .update({ is_active: !profile.is_active })
                    .eq("id", profile.id);
                  queryClient.invalidateQueries({ queryKey: ["admin"] });
                }}
              >
                {profile.is_active ? "Deactivate" : "Activate"}
              </Button>
            </div>
          ))}
          <p className="px-5 py-3 text-xs text-muted-foreground">
            New staff sign up at /auth; the first account becomes super admin.
          </p>
        </div>
      )}
    </>
  );
}

const PIN_KINDS = [
  ["tv", "TV board PIN"],
  ["cash", "Cash desk PIN"],
  ["greeter", "Greeter PIN"],
] as const;

function DevicePins() {
  const [pins, setPins] = useState<Record<string, string>>({ tv: "", cash: "", greeter: "" });

  async function save(kind: string) {
    const value = pins[kind];
    if (!/^\d{4,6}$/.test(value)) {
      toast.error("PIN must be 4-6 digits");
      return;
    }
    const { error } = await supabase.from("access_pins").upsert({ kind, pin: value });
    if (error) return toast.error(error.message);
    toast.success("PIN updated");
    setPins({ ...pins, [kind]: "" });
  }

  return (
    <div className="rounded-xl border border-border p-5">
      <h2 className="font-display text-sm font-semibold uppercase tracking-wide">Device PINs</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Used to unlock the TV board, cash settlement and greeter screens. Existing PINs are never shown.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {PIN_KINDS.map(([kind, label]) => (
          <div key={kind} className="space-y-1.5">
            <Label htmlFor={`pin-${kind}`}>{label}</Label>
            <Input
              id={`pin-${kind}`}
              inputMode="numeric"
              placeholder="New PIN"
              value={pins[kind]}
              onChange={(e) =>
                setPins({ ...pins, [kind]: e.target.value.replace(/\D/g, "").slice(0, 6) })
              }
            />
            <Button size="sm" variant="secondary" onClick={() => save(kind)}>
              Update
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
