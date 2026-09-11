import { Redis } from "@upstash/redis";
import type { SagaReport } from "@/lib/gmail";
import Link from "next/link";

const redis = Redis.fromEnv();
export const dynamic = "force-dynamic";

// Turns the email's date header into something readable,
// e.g. "Fri, 11 Sep 2026 14:26:45 +0000" -> "11 September 2026"
function formatDate(raw: string): string {
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function Home() {
  const report = await redis.get<SagaReport>("latest-report");

  if (!report || !report.reportHtml) {
    return (
      <main
        style={{
          fontFamily: "system-ui, -apple-system, sans-serif",
          maxWidth: 640,
          margin: "0 auto",
          padding: "4rem 1.5rem",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0 }}>
          {report ? report.subject : "Reports"}
        </h1>
        <p style={{ color: "#666", marginTop: 8, fontSize: 15 }}>
          {report
            ? "This report couldn't be displayed. Check the original email."
            : "No report has been received yet."}
        </p>
      </main>
    );
  }

  return (
    <main style={{ width: "100%", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          padding: "14px 20px",
          borderBottom: "1px solid #e8e8e8",
          background: "#fff",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 500,
              color: "#111",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {report.subject}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "#666" }}>
            Published {formatDate(report.date)}
          </p>
        </div>
        <Link
          href="/reports"
          style={{
            fontSize: 13,
            color: "#2563eb",
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          Past reports →
        </Link>
      </header>

      <iframe
        srcDoc={report.reportHtml}
        style={{
          width: "100%",
          minHeight: "100vh",
          border: "none",
          display: "block",
        }}
        title={report.subject}
      />
    </main>
  );
}