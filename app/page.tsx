import { Redis } from "@upstash/redis";
import type { SagaReport } from "@/lib/gmail";

const redis = Redis.fromEnv();

export const dynamic = "force-dynamic";

export default async function Home() {
  const report = await redis.get<SagaReport>("latest-report");

  if (!report) {
    return (
      <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
        <h1>SAGA Reports</h1>
        <p>No report has been received yet. Check back soon.</p>
      </main>
    );
  }

  if (!report.reportHtml) {
    return (
      <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
        <h1>{report.subject}</h1>
        <p style={{ color: "#666" }}>{report.date}</p>
        <p>
          Couldn&apos;t find the embedded report inside this email. Check the
          original email in Gmail.
        </p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto" }}>
      <p style={{ padding: "1rem 1rem 0", color: "#666", fontFamily: "sans-serif" }}>
        Latest report — {report.date}
      </p>
      {/* The iframe fully isolates SAGA's own HTML, CSS, and scripts from
          this page, so its layout and animations render exactly as designed. */}
      <iframe
        srcDoc={report.reportHtml}
        style={{ width: "100%", minHeight: "1400px", border: "none" }}
        title={report.subject}
      />
    </main>
  );
}