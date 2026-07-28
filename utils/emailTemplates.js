// Responsive, table-based HTML emails (table layout for maximum email-
// client compatibility) sharing one branded header/footer. Brand colors
// match the public website (blue -> pink gradient) and Crest logo.

const SCHOOL_NAME = 'Hampsons Group of School';
const LOGO_URL = process.env.SCHOOL_LOGO_URL || 'https://hampsonsgroupofschool.edu.ng/logo-removebg-preview.png';
const SCHOOL_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'info@hampsonsgroupofschool.edu.ng';
const SCHOOL_WEBSITE = process.env.CLIENT_URL || 'http://localhost:5173';

function shell({ preheader = '', bodyHtml }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${SCHOOL_NAME}</title>
</head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:'Work Sans',Arial,sans-serif;">
  <span style="display:none;font-size:1px;color:#F8FAFC;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.08);">
          <tr>
            <td style="background:linear-gradient(90deg,#2563EB,#EC4899);padding:28px 32px;text-align:left;">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                <td style="padding-right:12px;"><img src="${LOGO_URL}" width="40" height="40" alt="${SCHOOL_NAME}" style="display:block;border-radius:8px;background:#fff;padding:2px;" /></td>
                <td style="color:#ffffff;font-size:18px;font-weight:700;">${SCHOOL_NAME}</td>
              </tr></table>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background:#F8FAFC;border-top:1px solid #E5E7EB;">
              <p style="margin:0 0 4px;font-size:12px;color:#6B7280;">${SCHOOL_NAME} &middot; <a href="mailto:${SCHOOL_EMAIL}" style="color:#EC4899;text-decoration:none;">${SCHOOL_EMAIL}</a></p>
              <p style="margin:0;font-size:12px;color:#9CA3AF;">This is an automated message from the ${SCHOOL_NAME} management system. Please do not share your login details or OTP with anyone, including school staff.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function heading(text) {
  return `<h1 style="margin:0 0 12px;font-size:20px;color:#111827;font-weight:700;">${text}</h1>`;
}
function paragraph(text) {
  return `<p style="margin:0 0 16px;font-size:14px;line-height:22px;color:#334155;">${text}</p>`;
}
function button(label, url) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;"><tr><td style="border-radius:9999px;background:linear-gradient(90deg,#2563EB,#EC4899);">
    <a href="${url}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:9999px;">${label}</a>
  </td></tr></table>`;
}

function otpTemplate({ fullName, otp, minutes = 10 }) {
  const bodyHtml = `
    ${heading('Password Reset Code')}
    ${paragraph(`Hi ${fullName || 'there'},`)}
    ${paragraph('Use the verification code below to reset your password. This code is valid for a limited time.')}
    <div style="text-align:center;margin:24px 0;">
      <span style="display:inline-block;font-size:32px;letter-spacing:8px;font-weight:700;color:#111827;background:#F8FAFC;border:1px dashed #E5E7EB;border-radius:12px;padding:16px 24px;">${otp}</span>
    </div>
    ${paragraph(`This code expires in <strong>${minutes} minutes</strong> and can only be used once.`)}
    ${paragraph('If you did not request a password reset, you can safely ignore this email — your password will not be changed.')}
  `;
  return {
    subject: `${otp} is your ${SCHOOL_NAME} verification code`,
    html: shell({ preheader: `Your verification code is ${otp}`, bodyHtml }),
  };
}

function passwordResetSuccessTemplate({ fullName }) {
  const bodyHtml = `
    ${heading('Your password was changed')}
    ${paragraph(`Hi ${fullName || 'there'},`)}
    ${paragraph('Your password was successfully reset. You can now sign in with your new password.')}
    ${paragraph("If you didn't make this change, contact the school administrator immediately.")}
  `;
  return {
    subject: `Your ${SCHOOL_NAME} password was reset`,
    html: shell({ preheader: 'Your password was reset', bodyHtml }),
  };
}

function welcomeTemplate({ fullName, roleLabel, loginIdentifier, tempPassword, loginPath }) {
  const bodyHtml = `
    ${heading(`Welcome to ${SCHOOL_NAME}`)}
    ${paragraph(`Hi ${fullName},`)}
    ${paragraph(`A ${roleLabel} account has been created for you on the ${SCHOOL_NAME} management system.`)}
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#F8FAFC;border-radius:12px;margin:16px 0;">
      <tr><td style="padding:16px 20px;font-size:13px;color:#334155;">
        <p style="margin:0 0 6px;"><strong>Login:</strong> ${loginIdentifier}</p>
        <p style="margin:0;"><strong>Temporary password:</strong> ${tempPassword}</p>
      </td></tr>
    </table>
    ${paragraph("You'll be asked to set a new password the first time you sign in.")}
    ${button('Sign in', `${SCHOOL_WEBSITE}${loginPath}`)}
    ${paragraph('Please keep these details private and do not share them with anyone.')}
  `;
  return {
    subject: `Your ${SCHOOL_NAME} ${roleLabel} account is ready`,
    html: shell({ preheader: `Your ${roleLabel} account is ready`, bodyHtml }),
  };
}

function accountStatusTemplate({ fullName, status }) {
  const activated = status === 'active';
  const bodyHtml = `
    ${heading(activated ? 'Account activated' : 'Account deactivated')}
    ${paragraph(`Hi ${fullName || 'there'},`)}
    ${paragraph(
      activated
        ? 'Your account has been reactivated. You can now sign in as usual.'
        : 'Your account has been deactivated by a school administrator. You will not be able to sign in until it is reactivated.'
    )}
    ${paragraph('If you believe this is a mistake, please contact the school administrator.')}
  `;
  return {
    subject: activated ? `Your ${SCHOOL_NAME} account is active` : `Your ${SCHOOL_NAME} account was deactivated`,
    html: shell({ preheader: activated ? 'Account activated' : 'Account deactivated', bodyHtml }),
  };
}

function tempPasswordIssuedTemplate({ fullName, tempPassword, loginPath }) {
  const bodyHtml = `
    ${heading('Your password was reset by an administrator')}
    ${paragraph(`Hi ${fullName || 'there'},`)}
    ${paragraph('A school administrator has issued you a new temporary password.')}
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#F8FAFC;border-radius:12px;margin:16px 0;">
      <tr><td style="padding:16px 20px;font-size:13px;color:#334155;">
        <p style="margin:0;"><strong>Temporary password:</strong> ${tempPassword}</p>
      </td></tr>
    </table>
    ${paragraph("You'll be asked to set your own password the next time you sign in.")}
    ${button('Sign in', `${SCHOOL_WEBSITE}${loginPath}`)}
    ${paragraph("If you didn't request this, contact the school administrator immediately.")}
  `;
  return {
    subject: `Your ${SCHOOL_NAME} password was reset`,
    html: shell({ preheader: 'A new temporary password was issued', bodyHtml }),
  };

}

function admissionInstructionsTemplate({
  guardianName, studentFullName, applicationNumber, admissionFeeAmount,
  schoolVisitDate, examDate, examStartTime, examEndTime, examDurationMinutes,
  schoolAddress, schoolPhones, schoolEmail, instructions,
}) {
  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { dateStyle: 'long' }) : 'To be announced');
  const feeStr = admissionFeeAmount ? `₦${Number(admissionFeeAmount).toLocaleString()}` : 'To be announced';
  const phonesStr = Array.isArray(schoolPhones) ? schoolPhones.filter(Boolean).join(', ') : (schoolPhones || '—');
  const bodyHtml = `
    ${heading('Application Received — Next Steps')}
    ${paragraph(`Hi ${guardianName},`)}
    ${paragraph(`Thank you for applying to ${SCHOOL_NAME}. We've received the application for <strong>${studentFullName}</strong> (Application No. <strong>${applicationNumber}</strong>).`)}
    ${paragraph('Please note that payment and the entrance examination are both completed physically at the school — there is no online payment. Kindly bring the details below with you.')}
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#F8FAFC;border-radius:12px;margin:16px 0;">
      <tr><td style="padding:16px 20px;font-size:13px;color:#334155;">
        <p style="margin:0 0 6px;"><strong>Amount to pay:</strong> ${feeStr}</p>
        <p style="margin:0 0 6px;"><strong>Date to come to the school:</strong> ${fmtDate(schoolVisitDate)}</p>
        <p style="margin:0 0 6px;"><strong>Entrance exam date:</strong> ${fmtDate(examDate)}</p>
        <p style="margin:0 0 6px;"><strong>Entrance exam time:</strong> ${examStartTime || '—'} – ${examEndTime || '—'} (${examDurationMinutes || '—'} minutes)</p>
        <p style="margin:0 0 6px;"><strong>School address:</strong> ${schoolAddress || '—'}</p>
        <p style="margin:0 0 6px;"><strong>School phone number(s):</strong> ${phonesStr}</p>
        <p style="margin:0;"><strong>School email:</strong> ${schoolEmail || '—'}</p>
      </td></tr>
    </table>
    ${paragraph(instructions || 'Payment and the examination will be done physically at the school.')}
  `;
  return {
    subject: `Application received — next steps for ${studentFullName}, ${SCHOOL_NAME}`,
    html: shell({ preheader: 'Your admission application was received — payment and exam details enclosed', bodyHtml }),
  };
}

function admissionApprovedTemplate({ guardianName, studentFullName, notes }) {
  const bodyHtml = `
    ${heading('Application Approved 🎉')}
    ${paragraph(`Hi ${guardianName},`)}
    ${paragraph(`We're delighted to offer <strong>${studentFullName}</strong> a place at ${SCHOOL_NAME}.`)}
    ${notes ? paragraph(notes) : ''}
    ${button('Contact Admissions', `${SCHOOL_WEBSITE}/contact`)}
    ${paragraph('Congratulations, and welcome to the Hampsons family!')}
  `;
  return {
    subject: `Congratulations! ${studentFullName}'s application was approved`,
    html: shell({ preheader: 'Your admission application was approved', bodyHtml }),
  };
}

function admissionRejectedTemplate({ guardianName, studentFullName, notes }) {
  const bodyHtml = `
    ${heading('Application Update')}
    ${paragraph(`Hi ${guardianName},`)}
    ${paragraph(`Thank you for your interest in ${SCHOOL_NAME} and for applying on behalf of <strong>${studentFullName}</strong>.`)}
    ${paragraph("After careful review, we're unable to offer a place at this time.")}
    ${notes ? paragraph(notes) : ''}
    ${paragraph('We encourage you to apply again in a future admission cycle. Thank you for considering us.')}
  `;
  return {
    subject: `Update on ${studentFullName}'s application`,
    html: shell({ preheader: 'An update on your admission application', bodyHtml }),
  };
}

function contactConfirmationTemplate({ name }) {
  const bodyHtml = `
    ${heading("We've received your message")}
    ${paragraph(`Hi ${name || 'there'},`)}
    ${paragraph(`Thanks for reaching out to ${SCHOOL_NAME}. Our team will review your message and get back to you shortly.`)}
  `;
  return {
    subject: `We've received your message — ${SCHOOL_NAME}`,
    html: shell({ preheader: "We've received your message", bodyHtml }),
  };
}

function eventNotificationTemplate({ fullName, eventTitle, startDate, venue }) {
  const when = startDate ? new Date(startDate).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '';
  const bodyHtml = `
    ${heading('New Event')}
    ${paragraph(`Hi ${fullName || 'there'},`)}
    ${paragraph(`A new event has been posted: <strong>${eventTitle}</strong>.`)}
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#F8FAFC;border-radius:12px;margin:16px 0;">
      <tr><td style="padding:16px 20px;font-size:13px;color:#334155;">
        ${when ? `<p style="margin:0 0 6px;"><strong>When:</strong> ${when}</p>` : ''}
        ${venue ? `<p style="margin:0;"><strong>Where:</strong> ${venue}</p>` : ''}
      </td></tr>
    </table>
    ${button('View Events', `${SCHOOL_WEBSITE}/events`)}
  `;
  return {
    subject: `New event: ${eventTitle}`,
    html: shell({ preheader: `New event: ${eventTitle}`, bodyHtml }),
  };
}

module.exports = {
  otpTemplate,
  passwordResetSuccessTemplate,
  welcomeTemplate,
  accountStatusTemplate,
  tempPasswordIssuedTemplate,
  admissionInstructionsTemplate,
  admissionApprovedTemplate,
  admissionRejectedTemplate,
  contactConfirmationTemplate,
  eventNotificationTemplate,
};
