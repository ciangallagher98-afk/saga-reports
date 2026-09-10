import { google } from "googleapis";

/**
 * Gmail messages are structured in "parts" (this is the MIME format emails
 * use). A simple email might have one part; an email with both a plain-text
 * and HTML version (most do) will have nested parts. This function digs
 * through that structure to find the actual readable content, preferring
 * HTML (so links/formatting survive) and falling back to plain text.
 */
function extractBody(payload: any): string {
  if (!payload) return "";

  // Base case: this part IS body content — decode it from base64 and return it.
  if (
    payload.body?.data &&
    (payload.mimeType === "text/html" || payload.mimeType === "text/plain")
  ) {
    return Buffer.from(payload.body.data, "base64url").toString("utf-8");
  }

  // Recursive case: this part contains sub-parts, so look inside them.
  if (payload.parts) {
    const htmlPart = payload.parts.find((p: any) => p.mimeType === "text/html");
    if (htmlPart) return extractBody(htmlPart);

    const textPart = payload.parts.find((p: any) => p.mimeType === "text/plain");
    if (textPart) return extractBody(textPart);

    for (const part of payload.parts) {
      const result = extractBody(part);
      if (result) return result;
    }
  }

  return "";
}

export type SagaReport = {
  id: string;
  subject: string;
  date: string;
  body: string;
};

/**
 * Connects to Gmail using your saved credentials and returns the most
 * recent email from the given sender address, or null if there isn't one.
 */
export async function getLatestSagaReport(
  senderEmail: string
): Promise<SagaReport | null> {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET
  );

  // The refresh token lets us get fresh access without you logging in again.
  oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN,
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  // Ask Gmail for the single most recent email from SAGA's address.
  const list = await gmail.users.messages.list({
    userId: "me",
    q: `from:${senderEmail}`,
    maxResults: 1,
  });

  const messageId = list.data.messages?.[0]?.id;
  if (!messageId) return null;

  // Fetch the full content of that email.
  const full = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });

  const headers = full.data.payload?.headers ?? [];
  const subject =
    headers.find((h) => h.name === "Subject")?.value ?? "SAGA Report";
  const date =
    headers.find((h) => h.name === "Date")?.value ?? new Date().toString();
  const body = extractBody(full.data.payload);

  return { id: messageId, subject, date, body };
}