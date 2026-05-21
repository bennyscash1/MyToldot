import { Resend } from 'resend';

export type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
};

let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

function resolveFromAddress(): string | undefined {
  const raw = process.env.RESEND_FROM ?? process.env.RESEND_FROM_EMAIL;
  return raw?.trim() || undefined;
}

export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<void> {
  const from = resolveFromAddress();
  const client = getResendClient();

  if (!client || !from) {
    console.warn(
      '[email] Skipping send: RESEND_API_KEY or RESEND_FROM / RESEND_FROM_EMAIL is not configured',
    );
    return;
  }

  const { error } = await client.emails.send({
    from,
    to,
    subject,
    html,
  });

  if (error) {
    throw new Error(error.message);
  }
}
