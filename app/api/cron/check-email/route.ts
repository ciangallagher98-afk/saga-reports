import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { getLatestSagaReport } from "@/lib/gmail";

const redis = Redis.fromEnv();

export async function GET(request: Request) {
  // Security check: only Vercel's own cron scheduler (or you, manually,
  // using the secret) is allowed to trigger this. Vercel automatically
  // sends this header on scheduled runs when CRON_SECRET is set as an
  // environment variable.
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const report = await getLatestSagaReport(process.env.SAGA_SENDER_EMAIL!);

  if (!report) {
    return NextResponse.json({ message: "No report found in the inbox yet." });
  }

  // Avoid re-saving the same report over and over — only write to the
  // database if this email's ID is different from the one we already have.
  const lastStoredId = await redis.get<string>("latest-report-id");
  if (lastStoredId === report.id) {
    return NextResponse.json({ message: "No new report since last check." });
  }

  await redis.set("latest-report", report);
  await redis.set("latest-report-id", report.id);

  return NextResponse.json({
    message: "New report saved.",
    subject: report.subject,
  });
}