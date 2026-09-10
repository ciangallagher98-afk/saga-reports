import { google } from "googleapis";
import { decode } from "he";

/**
 * Recursively searches a Gmail message's MIME parts for one matching the
 * given content type (e.g. "text/plain" or "text/html"), and returns its
 * decoded text. Returns an empty string if that type isn't found.
 */
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

/**
 * SAGA embeds the full report as HTML-escaped text (so &lt; instead of <)
 * inside the email, meant for a human to copy into a .html file. This finds
 * that embedded block by its escaped start ("&lt;!doctype html") and end
 * ("&lt;/html&gt;"), then decodes the escaping to get back real HTML.
 */
function findEmbeddedHtmlDocument(text: string): string | null {
  const startMarker = /&lt;!doctype html/i;
  const endMarker = /&lt;\/html&gt;/i;

  const startMatch = startMarker.exec(text);
  if (!startMatch) return null;

  const remainder = text.slice(startMatch.index);
  const endMatch = endMarker.exec(remainder);
  if (!endMatch) return null;

  const endIndex = endMatch.index + endMatch[0].length;
  const raw = remainder.slice(0, endIndex);

  return decode(raw);
}

export type SagaReport = {
  id: string;
  subject: string;
  date: string;
  reportHtml: string | null;
};

/**
 * Connects to Gmail using your saved credentials, finds the most recent
 * email from the given sender, and pulls out the full HTML report embedded
 * inside it. Returns null if there's no email at all from that sender.
 */
export async function getLatestSagaReport(
  senderEmail: string
): Promise<SagaReport | null> {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN,
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  const list = await gmail.users.messages.list({
    userId: "me",
    q: `from:${senderEmail}`,
    maxResults: 1,
  });

  const messageId = list.data.messages?.[0]?.id;
  if (!messageId) return null;

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

  // The plain-text version is clean (no syntax-highlighting tags breaking
  // up the code), so check it first. Fall back to the HTML version only if
  // the plain-text part is missing or doesn't contain the embedded report.
  const plainText = getPartText(full.data.payload, "text/plain");
  const htmlText = getPartText(full.data.payload, "text/html");

  const reportHtml =
    findEmbeddedHtmlDocument(plainText) ?? findEmbeddedHtmlDocument(htmlText);

  return { id: messageId, subject, date, reportHtml };
}