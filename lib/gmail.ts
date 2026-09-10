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
 * SAGA's email contains a full, self-contained HTML report pasted as text
 * inside the message (meant for a human to copy into a .html file). This
 * function finds that embedded report by looking for its start
 * ("<!DOCTYPE html>") and end ("</html>") and extracts just that chunk.
 *
 * `escaped` should be true when searching the HTML version of the email
 * (where < and > are converted to &lt; and &gt; so they display as visible
 * text instead of being rendered) — in that case we also decode the escaped
 * characters back to normal HTML afterward.
 */
function findEmbeddedHtmlDocument(text: string, escaped: boolean): string | null {
  const startMarker = escaped ? /&lt;!doctype html/i : /<!doctype html/i;
  const endMarker = escaped ? /&lt;\/html&gt;/i : /<\/html>/i;

  const startMatch = startMarker.exec(text);
  if (!startMatch) return null;

  const remainder = text.slice(startMatch.index);
  const endMatch = endMarker.exec(remainder);
  if (!endMatch) return null;

  const endIndex = endMatch.index + endMatch[0].length;
  const raw = remainder.slice(0, endIndex);

  return escaped ? decode(raw) : raw;
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

  // Try the plain-text version of the email first — if the report is
  // embedded there, it's usually already unescaped (no &lt; to decode).
  const plainText = getPartText(full.data.payload, "text/plain");
  const htmlText = getPartText(full.data.payload, "text/html");

  const reportHtml =
    findEmbeddedHtmlDocument(plainText, false) ??
    findEmbeddedHtmlDocument(htmlText, true);

  return { id: messageId, subject, date, reportHtml };
}