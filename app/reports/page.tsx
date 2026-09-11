import { Redis } from "@upstash/redis";
import Link from "next/link";

const redis = Redis.fromEnv();
export const dynamic = "force-dynamic";

type ReportIndexEntry = { id: string; subject: string; date: string };

function formatDate(raw: string): string {
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function ReportsArchive() {
  const entries = await redis.lrange<ReportIndexEntry>("report-index", 0, -1);
  const hasEntries = entries && entries.length > 0;

  return (
    <main
      style={{
        fontFamily: "system-ui, -apple-system, sans-serif",
        maxWidth: 680,
        margin: "0 auto",
        padding: "3rem 1.5rem",
      }}
    >
      <Link
        href="/"
        style={{
          fontSize: 13,
          color: "#2563eb",
          textDecoration: "none",
        }}
      >
        ← Latest report
      </Link>

      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginTop: 24,
          marginBottom: 4,
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0, color: "#111" }}>
          Past reports
        </h1>
        {hasEntries && (
          <span style={{ fontSize: 13, color: "#888" }}>
            {entries.length} {entries.length === 1 ? "report" : "reports"}
          </span>
        )}
      </div>

      {!hasEntries && (
        <p style={{ color: "#666", fontSize: 15, marginTop: 16 }}>
          Reports will appear here once they&apos;ve been received.
        </p>
      )}

      {hasEntries && (
        <div style={{ marginTop: 20 }}>
          {entries.map((entry, i) => (
            <Link
              key={entry.id}
              href={`/reports/${entry.id}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                padding: "16px 0",
                borderTop: "1px solid #eee",
                textDecoration: "none",
              }}
            >
              <span style={{ minWidth: 0 }}>
                <span
                  style={{
                    display: "block",
                    fontSize: 15,
                    fontWeight: 500,
                    color: "#111",
                  }}
                >
                  {entry.subject}
                </span>
                <span
                  style={{
                    display: "block",
                    fontSize: 13,
                    color: "#666",
                    marginTop: 2,
                  }}
                >
                  {formatDate(entry.date)}
                </span>
              </span>
              {i === 0 ? (
                <span
                  style={{
                    fontSize: 12,
                    color: "#1d4ed8",
                    background: "#eff6ff",
                    padding: "3px 9px",
                    borderRadius: 6,
                    whiteSpace: "nowrap",
                  }}
                >
                  Latest
                </span>
              ) : (
                <span style={{ color: "#bbb", fontSize: 16 }}>›</span>
              )}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}