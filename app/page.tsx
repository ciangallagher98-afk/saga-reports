import { Redis } from "@upstash/redis";
import type { SagaReport } from "@/lib/gmail";

const redis = Redis.fromEnv();

// This tells Next.js: never cache this page, always fetch fresh data
// from the database on every visit. That's what makes the site
// "always updating" rather than frozen at build time.
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

  return (
    <main
      style={{
        padding: "2rem",
        fontFamily: "sans-serif",
        maxWidth: 800,
        margin: "0 auto",
      }}
    >
      <h1>{report.subject}</h1>
      <p style={{ color: "#666" }}>{report.date}</p>
      <hr style={{ margin: "1.5rem 0" }} />
      {/* The report body comes from SAGA's own email, which you control,
          so rendering its HTML directly here is safe. */}
      <div dangerouslySetInnerHTML={{ __html: report.body }} />
    </main>
  );
}