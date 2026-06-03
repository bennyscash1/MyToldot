import { z } from 'zod';

export const contactFormSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().pipe(z.email()),
  phone: z.string().trim().min(7).regex(/^[\d\s+\-]+$/),
  message: z.string().trim().min(5),
});

export type ContactFormInput = z.infer<typeof contactFormSchema>;
