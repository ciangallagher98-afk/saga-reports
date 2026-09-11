import { google } from "googleapis";
import { decode } from "he";

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
 * Finds the most recent email from the given sender whose subject contains
 * the given filter text, and extracts the HTML report embedded inside it.
 *
 * The subject filter is what lets multiple client sites share one inbox:
 * each site only looks at emails matching its own client's report name.
 * If no filter is given, it matches any email from that sender.
 */
export async function getLatestSagaReport(
  senderEmail: string,
  subjectFilter?: string
): Promise<SagaReport | null> {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  // Build the Gmail search query. Quoting the subject keeps multi-word
  // filters (e.g. "UK Womenswear") together as one phrase.
  let query = `from:${senderEmail}`;
  if (subjectFilter) {
    query += ` subject:"${subjectFilter}"`;
  }

  const list = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults: 1,
  });

  const messageId = list.data.messages?.[0]?.id;
  if (!messageId) return null;

  const full = await gmail.users.messages.get({
    userId: "me",
    id: messageId,