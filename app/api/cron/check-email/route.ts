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

  // TEMPORARY: duplicate-check disabled while we fix extraction logic on
  // the same test email. Re-enable this once confirmed working (see the
  // commented block below) by deleting these two lines and uncommenting it.

  await redis.set("latest-report", report);
  await redis.set("latest-report-id", report.id);

  return NextResponse.json({
    message: "Report re-processed and saved.",
    subject: report.subject,
    foundReportHtml: report.reportHtml !== null,
  });

  // --- Normal duplicate-check version (restore this after testing) ---
  // const lastStoredId = await redis.get<string>("latest-report-id");
  // if (lastStoredId === report.id) {
  //   return NextResponse.json({ message: "No new report since last check." });
  // }
  //
  // await redis.set("latest-report", report);
  // await redis.set("latest-report-id", report.id);
  //
  // return NextResponse.json({
  //   message: "New report saved.",
  //   subject: report.subject,
  //   foundReportHtml: report.reportHtml !== null,
  // });
}