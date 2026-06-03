/**
 * POST /api/v1/contact
 *
 * Public contact form submission — proxies to EmailJS server-side so
 * credentials never reach the client.
 */

import { NextRequest } from 'next/server';

import { contactFormSchema } from '@/features/contact/contact.schema';
import { Errors } from '@/lib/api/errors';
import { ok, withErrorHandler } from '@/lib/api/response';

const EMAILJS_SEND_URL = 'https://api.emailjs.com/api/v1.0/email/send';

function requireEmailJsEnv(): {
  serviceId: string;
  templateId: string;
  publicKey: string;
  privateKey: string;
} {
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const templateId = process.env.EMAILJS_TEMPLATE_ID;
  const publicKey = process.env.EMAILJS_PUBLIC_KEY;
  const privateKey = process.env.EMAILJS_PRIVATE_KEY;

  if (!serviceId || !templateId || !publicKey || !privateKey) {
    console.error('[contact] Missing EmailJS environment variables');
    throw Errors.internal('Contact form is not configured');
  }

  return { serviceId, templateId, publicKey, privateKey };
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  const json = await req.json().catch(() => {
    throw Errors.badRequest('Request body must be valid JSON');
  });

  const parsed = contactFormSchema.safeParse(json);
  if (!parsed.success) {
    throw Errors.validation('Validation failed', {
      issues: parsed.error.flatten(),
    });
  }

  const { name, email, phone, message } = parsed.data;
  const { serviceId, templateId, publicKey, privateKey } = requireEmailJsEnv();

  const response = await fetch(EMAILJS_SEND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      accessToken: privateKey,
      template_params: {
        name,
        email,
        phone,
        message,
      },
    }),
  });

  if (!response.ok) {
    console.error('[contact] EmailJS send failed', { status: response.status });
    throw Errors.emailSendFailed();
  }

  return ok({ sent: true });
});
