import { NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  const list = await gmail.users.messages.list({
    userId: "me",
    q: `from:${process.env.SAGA_SENDER_EMAIL}`,
    maxResults: 1,
  });

  const messageId = list.data.messages?.[0]?.id;
  if (!messageId) {
    return NextResponse.json({ message: "No email found." });
  }

  const full = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });

  // Recursively list every MIME part's type and how long its content is.
  function describeParts(payload: any, path = "root"): any[] {
    const results: any[] = [];
    if (payload.mimeType && payload.body?.size !== undefined) {
      results.push({ path, mimeType: payload.mimeType, size: payload.body.size });
    }
    if (payload.parts) {
      payload.parts.forEach((p: any, i: number) => {
        results.push(...describeParts(p, `${path} > part[${i}]`));
      });
    }
    return results;
  }

  function getPartText(payload: any, mimeType: string): string {
    if (!payload) return "";
    if (payload.mimeType === mimeType && payload.body?.data) {
      return Buffer.from(payload.body.data, "base64url").toString("utf-8");
    }
    if (payload.parts) {
      for (const part of payload.parts) {
        const result = getPartText(part, mimeType);
        if (result) return result;
      }
    }
    return "";
  }

  const plainText = getPartText(full.data.payload, "text/plain");
  const htmlText = getPartText(full.data.payload, "text/html");

  // Find roughly where "doctype" appears (case-insensitive) so we can see
  // exactly what surrounds it, in either version of the email.
  function snippetAroundDoctype(text: string): string | null {
    const idx = text.toLowerCase().indexOf("doctype");
    if (idx === -1) return null;
    return text.slice(Math.max(0, idx - 50), idx + 500);
  }

  return NextResponse.json({
    parts: describeParts(full.data.payload),
    plainTextLength: plainText.length,
    htmlTextLength: htmlText.length,
    plainTextSnippetAroundDoctype: snippetAroundDoctype(plainText),
    htmlTextSnippetAroundDoctype: snippetAroundDoctype(htmlText),
  });
}