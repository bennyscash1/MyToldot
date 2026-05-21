import type { PreferredLocale } from '@/lib/locale-preference';
import { sendEmail } from '@/server/lib/email';

export type EditorRequestEmailParams = {
  to: string;
  ownerName: string;
  ownerLanguage: PreferredLocale;
  requesterName: string;
  requesterEmail: string;
  treeName: string;
  manageUrl: string;
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildHeContent(p: EditorRequestEmailParams) {
  const subject = `בקשת הרשאת עריכה ב${p.treeName}`;
  const html = `<div dir="rtl" lang="he" style="font-family: Arial, Helvetica, sans-serif; line-height: 1.5;">
<p>שלום ${escapeHtml(p.ownerName)},</p>
<p>${escapeHtml(p.requesterName)} (${escapeHtml(p.requesterEmail)}) ביקש/ה הרשאת עריכה במשפחת ${escapeHtml(p.treeName)}.</p>
<p>לאישור או דחייה של הבקשה, היכנס לעמוד הניהול של המשפחה:<br>
<a href="${escapeHtml(p.manageUrl)}">${escapeHtml(p.manageUrl)}</a></p>
<p>תודה,<br>צוות Toldotay</p>
</div>`;
  return { subject, html };
}

function buildEnContent(p: EditorRequestEmailParams) {
  const subject = `Edit access request for ${p.treeName}`;
  const html = `<div dir="ltr" lang="en" style="font-family: Arial, Helvetica, sans-serif; line-height: 1.5;">
<p>Hello ${escapeHtml(p.ownerName)},</p>
<p>${escapeHtml(p.requesterName)} (${escapeHtml(p.requesterEmail)}) requested edit access for ${escapeHtml(p.treeName)}.</p>
<p>To approve or decline, open the family management page:<br>
<a href="${escapeHtml(p.manageUrl)}">${escapeHtml(p.manageUrl)}</a></p>
<p>Thank you,<br>The Toldotay team</p>
</div>`;
  return { subject, html };
}

export async function sendEditorRequestEmail(
  params: EditorRequestEmailParams,
): Promise<void> {
  const content =
    params.ownerLanguage === 'en' ? buildEnContent(params) : buildHeContent(params);
  await sendEmail({
    to: params.to,
    subject: content.subject,
    html: content.html,
  });
}
