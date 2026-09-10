import { Redis } from "@upstash/redis";
import Link from "next/link";

const redis = Redis.fromEnv();
export const dynamic = "force-dynamic";

type ReportIndexEntry = { id: string; subject: string; date: string };

export default async function ReportsArchive() {
  const entries = await redis.lrange<ReportIndexEntry>("report-index", 0, -1);

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: 800, margin: "0 auto" }}>
      <h1>Past Reports</h1>
      {(!entries || entries.length === 0) && <p>No reports yet.</p>}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {entries?.map((entry) => (
          <li key={entry.id} style={{ padding: "0.75rem 0", borderBottom: "1px solid #eee" }}>
            <Link href={`/reports/${entry.id}`} style={{ fontWeight: 600 }}>
              {entry.subject}
            </Link>
            <div style={{ color: "#666", fontSize: "0.9rem" }}>{entry.date}</div>
          </li>
        ))}
      </ul>
    </main>
  );
}

