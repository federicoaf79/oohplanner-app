import { supabase } from './supabase'

/**
 * Sends an email via the send-email Edge Function (Resend).
 * @param {{ to: string|string[], subject: string, html: string, text?: string }} params
 */
export async function sendEmail({ to, subject, html, text }) {
  const { data, error } = await supabase.functions.invoke('send-email', {
    body: { to, subject, html, text },
  })
  return { data, error }
}
