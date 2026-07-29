import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Download, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { PageHeader } from "@/components/crm/ui";

export function FeedbackQR() {
  const [companyName, setCompanyName] = useState("BSC Retail");
  const feedbackUrl = `${window.location.origin}/feedback-public`;

  useEffect(() => {
    async function fetchCompany() {
      try {
        const { data } = await api.get("/crm/settings");
        if (data?.company_name) setCompanyName(data.company_name);
      } catch (err) {
        console.error("Failed to load settings", err);
      }
    }
    fetchCompany();
  }, []);

  function copyUrl() {
    navigator.clipboard.writeText(feedbackUrl);
    toast.success("Feedback link copied to clipboard");
  }

  function downloadQr() {
    const svg = document.getElementById("feedback-qr-code");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width + 40;
      canvas.height = img.height + 40;
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 20, 20);
      }
      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = `feedback-qr-${companyName.toLowerCase().replace(/\s+/g, "-")}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  }

  return (
    <>
      <PageHeader
        title="Feedback QR Standee"
        subtitle="Print or display on store billing counters to collect customer feedback."
      />

      <div className="mx-auto max-w-md">
        <div className="panel p-8 text-center shadow-lg">
          <p className="eyebrow">{companyName}</p>
          <h2 className="mt-2 font-display text-2xl font-bold">Tell us how we did today</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Scan to give quick store feedback. Takes under 1 minute.
          </p>

          <div className="my-8 flex justify-center rounded-2xl bg-white p-6 shadow-inner">
            <QRCodeSVG
              id="feedback-qr-code"
              value={feedbackUrl}
              size={220}
              level="H"
              includeMargin
            />
          </div>

          <p className="num text-xs text-muted-foreground">{feedbackUrl}</p>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              onClick={copyUrl}
              className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-card px-4 text-sm font-medium hover:bg-secondary transition-colors"
            >
              <Copy className="mr-2 h-4 w-4" /> Copy Link
            </button>
            <button
              onClick={downloadQr}
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Download className="mr-2 h-4 w-4" /> Download QR
            </button>
            <a
              href={feedbackUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-card px-4 text-sm font-medium hover:bg-secondary transition-colors"
            >
              <ExternalLink className="mr-2 h-4 w-4" /> Open Form
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
