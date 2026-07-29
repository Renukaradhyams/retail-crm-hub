import { useState, useEffect } from "react";
import { Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { PageHeader } from "@/components/crm/ui";
import { ROLE_LABELS } from "@/lib/crm";

export function Admin() {
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
    tv_pin: "9911",
    cash_pin: "1938",
    greeter_pin: "4567",
  });

  const [sections, setSections] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [newSection, setNewSection] = useState({ name: "", section_type: "floor", manager: "" });
  const [newQuestion, setNewQuestion] = useState("");
  const [newUser, setNewUser] = useState({ email: "", password: "", fullName: "", role: "crm_staff" });

  async function loadData() {
    setIsLoading(true);
    try {
      const [settingsRes, sectionsRes, questionsRes, usersRes] = await Promise.all([
        api.get("/crm/settings"),
        api.get("/crm/sections"),
        api.get("/crm/feedback-questions"),
        api.get("/crm/users"),
      ]);

      const s = settingsRes.data || {};
      setCompany({
        company_name: s.company_name || "",
        logo_url: s.logo_url || "",
        open_hour: String(s.open_hour ?? "10"),
        close_hour: String(s.close_hour ?? "22"),
        footfall_grace_minutes: String(s.footfall_grace_minutes ?? "30"),
        edit_cutoff_hours: String(s.edit_cutoff_hours ?? "3"),
        der_email: s.der_email || "",
        der_whatsapp_note: s.der_whatsapp_note || "",
        tv_pin: s.tv_pin || "9911",
        cash_pin: s.cash_pin || "1938",
        greeter_pin: s.greeter_pin || "4567",
      });

      setSections(sectionsRes.data || []);
      setQuestions(questionsRes.data || []);
      setUsers(usersRes.data || []);
    } catch (err) {
      console.error("Failed to load admin settings", err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function saveCompany(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.put("/crm/settings", {
        company_name: company.company_name,
        logo_url: company.logo_url || null,
        open_hour: Number(company.open_hour) || 10,
        close_hour: Number(company.close_hour) || 22,
        footfall_grace_minutes: Number(company.footfall_grace_minutes) || 30,
        edit_cutoff_hours: Number(company.edit_cutoff_hours) || 3,
        der_email: company.der_email || null,
        der_whatsapp_note: company.der_whatsapp_note || null,
        tv_pin: company.tv_pin,
        cash_pin: company.cash_pin,
        greeter_pin: company.greeter_pin,
      });
      toast.success("Store settings saved");
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to save settings");
    }
  }

  async function addSection(e: React.FormEvent) {
    e.preventDefault();
    if (!newSection.name.trim()) return toast.error("Section name required");
    try {
      await api.post("/crm/sections", newSection);
      toast.success("Section added");
      setNewSection({ name: "", section_type: "floor", manager: "" });
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to add section");
    }
  }

  async function removeSection(id: string) {
    try {
      await api.delete(`/crm/sections/${id}`);
      toast.success("Section removed");
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to remove section");
    }
  }

  async function addQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (!newQuestion.trim()) return toast.error("Question required");
    try {
      await api.post("/crm/feedback-questions", {
        question: newQuestion.trim(),
        options: ["Yes", "Maybe", "No"],
        position: questions.length + 1,
      });
      toast.success("Question added");
      setNewQuestion("");
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to add question");
    }
  }

  async function removeQuestion(id: string) {
    try {
      await api.delete(`/crm/feedback-questions/${id}`);
      toast.success("Question removed");
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to remove question");
    }
  }

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    if (!newUser.email || !newUser.password) return toast.error("Email & password required");
    try {
      await api.post("/crm/users", newUser);
      toast.success("User added");
      setNewUser({ email: "", password: "", fullName: "", role: "crm_staff" });
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to add user");
    }
  }

  async function updateUserRole(id: string, role: string) {
    try {
      await api.patch(`/crm/users/${id}`, { role });
      toast.success("Role updated");
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to update role");
    }
  }

  return (
    <>
      <PageHeader
        title="Admin Settings"
        subtitle="Store configuration, floor sections, feedback questions, and user access."
      />

      <div className="mb-6 flex flex-wrap gap-2 border-b border-border pb-3">
        {(["company", "sections", "questions", "people"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`h-9 px-4 rounded-md text-sm font-medium transition-colors capitalize ${
              tab === t ? "bg-primary text-primary-foreground" : "bg-card border border-input text-foreground hover:bg-secondary"
            }`}
          >
            {t === "company" ? "Store Profile" : t}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="panel p-6 text-sm text-muted-foreground">Loading admin settings…</div>
      ) : (
        <>
          {tab === "company" && (
            <form onSubmit={saveCompany} className="panel max-w-2xl space-y-4 p-6">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Store name</label>
                <input
                  value={company.company_name}
                  onChange={(e) => setCompany({ ...company, company_name: e.target.value })}
                  className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Opening hour (0-23)</label>
                  <input
                    value={company.open_hour}
                    onChange={(e) => setCompany({ ...company, open_hour: e.target.value })}
                    className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Closing hour (0-23)</label>
                  <input
                    value={company.close_hour}
                    onChange={(e) => setCompany({ ...company, close_hour: e.target.value })}
                    className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">TV Display PIN</label>
                  <input
                    value={company.tv_pin}
                    onChange={(e) => setCompany({ ...company, tv_pin: e.target.value })}
                    className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm num"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Cash Settlement PIN</label>
                  <input
                    value={company.cash_pin}
                    onChange={(e) => setCompany({ ...company, cash_pin: e.target.value })}
                    className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm num"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Greeter PIN</label>
                  <input
                    value={company.greeter_pin}
                    onChange={(e) => setCompany({ ...company, greeter_pin: e.target.value })}
                    className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm num"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">DER Email</label>
                <input
                  type="email"
                  value={company.der_email}
                  onChange={(e) => setCompany({ ...company, der_email: e.target.value })}
                  placeholder="manager@store.com"
                  className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                />
              </div>

              <button type="submit" className="h-10 px-6 rounded-md bg-primary text-primary-foreground font-medium text-sm inline-flex items-center">
                <Save className="mr-2 h-4 w-4" /> Save store settings
              </button>
            </form>
          )}

          {tab === "sections" && (
            <div className="space-y-6 max-w-2xl">
              <form onSubmit={addSection} className="panel flex items-end gap-3 p-5">
                <div className="flex-1 space-y-1.5">
                  <label className="text-sm font-medium">New section name</label>
                  <input
                    value={newSection.name}
                    onChange={(e) => setNewSection({ ...newSection, name: e.target.value })}
                    placeholder="e.g. Ground Floor Ethnic"
                    className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                  />
                </div>
                <button type="submit" className="h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium inline-flex items-center">
                  <Plus className="mr-2 h-4 w-4" /> Add section
                </button>
              </form>

              <div className="panel divide-y divide-border">
                {sections.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-medium text-sm">{s.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{s.section_type}</p>
                    </div>
                    <button onClick={() => removeSection(s.id)} className="h-8 px-2 text-destructive hover:bg-secondary rounded-md">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "questions" && (
            <div className="space-y-6 max-w-2xl">
              <form onSubmit={addQuestion} className="panel flex items-end gap-3 p-5">
                <div className="flex-1 space-y-1.5">
                  <label className="text-sm font-medium">New feedback question</label>
                  <input
                    value={newQuestion}
                    onChange={(e) => setNewQuestion(e.target.value)}
                    placeholder="e.g. Was the billing process smooth?"
                    className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                  />
                </div>
                <button type="submit" className="h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium inline-flex items-center">
                  <Plus className="mr-2 h-4 w-4" /> Add question
                </button>
              </form>

              <div className="panel divide-y divide-border">
                {questions.map((q, idx) => (
                  <div key={q.id} className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-medium text-sm">
                        <span className="num mr-2 text-muted-foreground">Q{idx + 1}</span>
                        {q.question}
                      </p>
                    </div>
                    <button onClick={() => removeQuestion(q.id)} className="h-8 px-2 text-destructive hover:bg-secondary rounded-md">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "people" && (
            <div className="space-y-6 max-w-3xl">
              <form onSubmit={addUser} className="panel grid gap-4 p-5 sm:grid-cols-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Name</label>
                  <input
                    value={newUser.fullName}
                    onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                    placeholder="Staff name"
                    className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Email</label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    placeholder="user@store.com"
                    className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Password</label>
                  <input
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    placeholder="••••••••"
                    className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                  />
                </div>
                <div className="flex items-end">
                  <button type="submit" className="h-9 w-full rounded-md bg-primary text-primary-foreground text-sm font-medium">
                    Add user
                  </button>
                </div>
              </form>

              <div className="panel overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/60 text-left">
                    <tr>
                      <th className="px-5 py-3 font-semibold">User</th>
                      <th className="px-3 py-3 font-semibold">Email</th>
                      <th className="px-5 py-3 font-semibold text-right">Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-t border-border/60">
                        <td className="px-5 py-3 font-medium">{u.full_name || "—"}</td>
                        <td className="num px-3 py-3 text-xs">{u.email}</td>
                        <td className="px-5 py-3 text-right">
                          <select
                            value={u.role}
                            onChange={(e) => updateUserRole(u.id, e.target.value)}
                            className="h-8 rounded-md border border-input bg-card px-2 text-xs"
                          >
                            {Object.entries(ROLE_LABELS).map(([k, label]) => (
                              <option key={k} value={k}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
