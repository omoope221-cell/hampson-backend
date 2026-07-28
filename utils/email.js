const logger = require('./logger');

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

// Uses the existing Brevo account — reads BREVO_API_KEY /
// BREVO_SENDER_EMAIL / BREVO_SENDER_NAME from the environment. See
// backend/.env.example for the variables this needs.
//
// Never throws: a broken email provider must not take down account
// creation, status changes, or the OTP flow. Callers should still branch
// on the return value where the user needs to know delivery failed (e.g.
// the OTP request endpoint), but every other call site can fire-and-forget.
async function sendEmail({ to, toName, subject, html }) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || 'Hampsons Group of School';

  if (!apiKey || !senderEmail) {
    logger.error(
      'Brevo is not configured (missing BREVO_API_KEY / BREVO_SENDER_EMAIL in .env) — email not sent: ' +
        `"${subject}" to ${to}`
    );
    return { sent: false, reason: 'not_configured' };
  }

  try {
    const res = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        sender: { email: senderEmail, name: senderName },
        to: [{ email: to, name: toName || to }],
        subject,
        htmlContent: html,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.error(`Brevo send failed (${res.status}): ${body}`);
      return { sent: false, reason: 'provider_error' };
    }

    return { sent: true };
  } catch (err) {
    logger.error(`Brevo send threw: ${err.message}`);
    return { sent: false, reason: 'network_error' };
  }
}

module.exports = { sendEmail };
