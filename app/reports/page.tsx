import { Redis } from "@upstash/redis";
import type { SagaReport } from "@/lib/gmail";
import Link from "next/link";

const redis = Redis.fromEnv();
export const dynamic = "force-dynamic";

export default async function ArchivedReport({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const report = await redis.get<SagaReport>(`report:${id}`);

  if (!report) {
    return (
      <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
        <p>Report not found. <Link href="/reports">Back to all reports</Link></p>
      </main>
    );
  }

  return (
    <main style={{ width: "100%" }}>
      <p style={{ padding: "1rem", margin: 0, fontFamily: "sans-serif" }}>
        <Link href="/reports">← All reports</Link>
        <span style={{ color: "#666" }}> — {report.date}</span>
      </p>
      {report.reportHtml ? (
        <iframe
          srcDoc={report.reportHtml}
          style={{ width: "100%", minHeight: "100vh", border: "none", display: "block" }}
          title={report.subject}
        />
      ) : (
        <p style={{ padding: "1rem", fontFamily: "sans-serif" }}>
          Couldn&apos;t find the embedded report inside this email.
        </p>
      )}
    </main>
  );
}