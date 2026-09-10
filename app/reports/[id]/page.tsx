import { Redis } from "@upstash/redis";
import type { SagaReport } from "@/lib/gmail";
import Link from "next/link";

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
        <p>Couldn&apos;t find the embedded report inside this email.</p>
      </main>
    );
  }

  return (
    <main style={{ width: "100%" }}>
      <p style={{ padding: "1rem", margin: 0, color: "#666", fontFamily: "sans-serif" }}>
        Latest report — {report.date} · <Link href="/reports">View past reports</Link>
      </p>
      <iframe
        srcDoc={report.reportHtml}
        style={{ width: "100%", minHeight: "100vh", border: "none", display: "block" }}
        title={report.subject}
      />
    </main>
  );
}