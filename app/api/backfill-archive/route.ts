import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import type { SagaReport } from "@/lib/gmail";

const redis = Redis.fromEnv();

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const report = await redis.get<SagaReport>("latest-report");

  if (!report) {
    return NextResponse.json({ message: "No 'latest-report' found to back-fill." });
  }

  await redis.set(`report:${report.id}`, report);
  await redis.lpush(
    "report-index",
    { id: report.id, subject: report.subject, date: report.date }
  );
  await redis.ltrim("report-index", 0, 59);

  return NextResponse.json({
    message: "Backfilled into archive.",
    subject: report.subject,
  });
}