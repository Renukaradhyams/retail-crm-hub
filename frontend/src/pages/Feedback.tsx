import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import api from "@/lib/api";
import { isNegative, type FeedbackAnswer } from "@/lib/crm";
import { istToday } from "@/lib/ist";
import { cn } from "@/lib/utils";

const detailsSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(80),
  mobile: z.string().trim().regex(/^[0-9]{10}$/, "Enter a 10-digit mobile number"),
  dob: z.string().max(10).optional(),
  voice: z.string().trim().max(1000).optional(),
});

export function Feedback() {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [dob, setDob] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [voice, setVoice] = useState("");
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<{ questions: any[]; sections: any[]; company: string } | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    async function loadForm() {
      try {
        const [questionsRes, sectionsRes, settingsRes] = await Promise.all([
          api.get("/crm/feedback-questions"),
          api.get("/crm/sections"),
          api.get("/crm/settings"),
        ]);
        setData({
          questions: questionsRes.data || [],
          sections: sectionsRes.data || [],
          company: settingsRes.data?.company_name || "BSC Retail",
        });
      } catch (err) {
        console.error("Failed to load feedback questions", err);
      }
    }
    loadForm();
  }, []);

  const questions = useMemo(() => data?.questions ?? [], [data]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = detailsSchema.safeParse({ name, mobile, dob, voice });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    if (questions.length && !answers[questions[0].id]) {
      toast.error("Please answer the first question");
      return;
    }

    setBusy(true);
    try {
      const payload: FeedbackAnswer[] = questions.map((q) => ({
        q: q.question,
        a: answers[q.id] ?? "",
      }));
      const section = data?.sections.find((s) => s.id === sectionId);
      const negative = isNegative(payload);

      await api.post("/crm/feedback", {
        entry_date: istToday(),
        customer_name: parsed.data.name,
        mobile: parsed.data.mobile,
        dob: dob || null,
        section_id: sectionId || null,
        section_name: section?.name ?? null,
        answers: payload,
        voice: voice.trim() || null,
        source: "qr",
        is_negative: negative,
      });

      navigate("/success");
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Could not submit feedback");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="bg-sidebar px-6 py-8 text-sidebar-foreground">
        <div className="mx-auto max-w-xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/50">
            {data?.company ?? "BSC Retail"}
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold">How was your visit?</h1>
          <p className="mt-2 text-sm text-sidebar-foreground/70">
            Under a minute. Your answers go straight to the store manager.
          </p>
        </div>
      </header>

      <form onSubmit={submit} className="mx-auto mt-8 max-w-xl space-y-6 px-6">
        <div className="panel space-y-4 p-6">
          <div className="space-y-1.5">
            <label htmlFor="name" className="text-sm font-medium">Your name</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="mobile" className="text-sm font-medium">Mobile number</label>
              <input
                id="mobile"
                inputMode="numeric"
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="10 digits"
                required
                className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="dob" className="text-sm font-medium">Date of birth (optional)</label>
              <input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="section" className="text-sm font-medium">Which area did you shop?</label>
            <select
              id="section"
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
            >
              <option value="">Select an area</option>
              {(data?.sections ?? []).map((section) => (
                <option key={section.id} value={section.id}>
                  {section.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="panel divide-y divide-border">
          {questions.map((question, index) => (
            <div key={question.id} className="p-6">
              <p className="text-sm font-medium">
                <span className="num mr-2 text-muted-foreground">Q{index + 1}</span>
                {question.question}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {question.options.map((option: string) => {
                  const selected = answers[question.id] === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setAnswers((prev) => ({ ...prev, [question.id]: option }))}
                      className={cn(
                        "rounded-full border px-4 py-2 text-sm transition-colors",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card hover:bg-secondary",
                      )}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="panel space-y-2 p-6">
          <label htmlFor="voice" className="text-sm font-medium">Your voice</label>
          <textarea
            id="voice"
            value={voice}
            onChange={(e) => setVoice(e.target.value)}
            maxLength={1000}
            rows={4}
            placeholder="Anything else you would like us to know?"
            className="w-full rounded-md border border-input bg-card p-3 text-sm"
          />
        </div>

        <button type="submit" className="h-12 w-full rounded-md bg-primary text-primary-foreground font-semibold text-base" disabled={busy}>
          {busy ? "Submitting…" : "Submit feedback"}
        </button>
      </form>
    </div>
  );
}
