import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { getLatestSagaReport } from "@/lib/gmail";

const redis = Redis.fromEnv();

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const report = await getLatestSagaReport(process.env.SAGA_SENDER_EMAIL!);

  if (!report) {
    return NextResponse.json({ message: "No report found in the inbox yet." });
  }

  const lastStoredId = await redis.get<string>("latest-report-id");
  if (lastStoredId === report.id) {
    return NextResponse.json({ message: "No new report since last check." });
  }

  // Save as "the latest" (what the homepage shows).
  await redis.set("latest-report", report);
  await redis.set("latest-report-id", report.id);

  // Also save permanently under its own key, and add it to the archive
  // index so the /reports page can list every report ever received.
  await redis.set(`report:${report.id}`, report);
  await redis.lpush(
    "report-index",
    { id: report.id, subject: report.subject, date: report.date }
  );
  // Keep the index list from growing forever — 60 entries covers 5 years
  // of monthly reports, which is more than enough headroom.
  await redis.ltrim("report-index", 0, 59);

  return NextResponse.json({
    message: "New report saved.",
    subject: report.subject,
    foundReportHtml: report.reportHtml !== null,
  });
}