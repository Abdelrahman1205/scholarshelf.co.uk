import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const resendFrom = process.env.RESEND_FROM_EMAIL || "EduBook <onboarding@resend.dev>";

const resend = resendApiKey ? new Resend(resendApiKey) : null;

export function isResendConfigured(): boolean {
  return !!resend;
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!resend) {
    return false;
  }

  try {
    await resend.emails.send({
      from: resendFrom,
      to,
      subject,
      html,
    });
    return true;
  } catch (error) {
    console.error("[Resend] Failed to send email:", error);
    return false;
  }
}

export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<boolean> {
  const html = `
    <h2>Reset your EduBook password</h2>
    <p>We received a request to reset your password.</p>
    <p><a href="${resetLink}">Click here to reset your password</a></p>
    <p>If you did not request this, you can ignore this email.</p>
    <p>This link expires in 1 hour.</p>
  `;

  return sendEmail(to, "Reset your EduBook password", html);
}

export async function sendInviteEmail(to: string, role: string, inviteLink: string): Promise<boolean> {
  const roleLabel = role.replace(/_/g, " ");
  const html = `
    <h2>You have been invited to EduBook</h2>
    <p>You were invited to join as <strong>${roleLabel}</strong>.</p>
    <p><a href="${inviteLink}">Click here to accept your invite</a></p>
    <p>This link expires in 7 days.</p>
  `;

  return sendEmail(to, "Your EduBook invite", html);
}
