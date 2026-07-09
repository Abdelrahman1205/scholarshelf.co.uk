import { Resend } from "resend";

// Support both RESEND_API_KEY (existing) and EMAIL_API_KEY (spec alias)
const resendApiKey = process.env.RESEND_API_KEY || process.env.EMAIL_API_KEY;

// Support both RESEND_FROM_EMAIL (existing) and EMAIL_FROM (spec alias).
// Env validation requires a PLAIN email address (e.g. noreply@scholarshelf.co.uk);
// the "Scholar Shelf <...>" display name is added here at send time.
const rawFrom =
  process.env.RESEND_FROM_EMAIL ||
  process.env.EMAIL_FROM ||
  "noreply@scholarshelf.co.uk";
const resendFrom = rawFrom.includes("<") ? rawFrom : `Scholar Shelf <${rawFrom}>`;

const resend = resendApiKey ? new Resend(resendApiKey) : null;

type EmailBranding = {
  schoolName?: string | null;
  logoUrl?: string | null;
  primaryColour?: string | null;
  secondaryColour?: string | null;
};

export function isResendConfigured(): boolean {
  return !!resend;
}

// ---------------------------------------------------------------------------
// Internal helper — all emails go through here
// ---------------------------------------------------------------------------
async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!resend) {
    console.warn("[Scholar Shelf Email] Resend not configured — no email sent.");
    return false;
  }

  try {
    const { error } = await resend.emails.send({
      from: resendFrom,
      to,
      subject,
      html,
    });
    if (error) {
      console.error("[Scholar Shelf Email] Resend error:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Scholar Shelf Email] Failed to send email:", err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Shared HTML wrapper — consistent Scholar Shelf styling
// ---------------------------------------------------------------------------
function wrapEmail(title: string, body: string, branding?: EmailBranding): string {
  const brandPrimary = branding?.primaryColour || "#1e3a5f";
  const brandSecondary = branding?.secondaryColour || "#0f172a";
  const appName = "Scholar Shelf";
  const schoolName = (branding?.schoolName || "").trim();
  const showSchoolName = schoolName.length > 0 && schoolName.toLowerCase() !== appName.toLowerCase();
  const logoUrl = branding?.logoUrl || null;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;">
          <!-- Header -->
          <tr>
            <td style="background:${brandPrimary};padding:20px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <div style="color:#ffffff;font-size:20px;font-weight:bold;letter-spacing:0.5px;line-height:1.2;">
                      ${appName}
                    </div>
                    ${showSchoolName ? `<div style="color:#dbeafe;font-size:13px;line-height:1.35;margin-top:4px;">${schoolName}</div>` : ""}
                  </td>
                  ${logoUrl ? `<td align="right" style="vertical-align:middle;width:180px;"><img src="${logoUrl}" alt="${showSchoolName ? schoolName : appName} logo" style="max-height:56px;max-width:170px;display:block;margin-left:auto;background:#ffffff;border-radius:6px;padding:4px;object-fit:contain;" /></td>` : ""}
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;color:#1a1a1a;font-size:15px;line-height:1.6;">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f4f4f5;padding:20px 32px;text-align:center;
                        font-size:12px;color:#6b7280;">
              &copy; ${new Date().getFullYear()} Scholar Shelf &mdash; scholarshelf.co.uk<br/>
              This email was sent automatically. Please do not reply.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  <div style="height:4px;background:${brandSecondary};"></div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// 1. Password Reset
// ---------------------------------------------------------------------------
export async function sendPasswordResetEmail(
  to: string,
  resetLink: string,
  branding?: EmailBranding
): Promise<boolean> {
  const body = `
    <h2 style="margin-top:0;color:#1e3a5f;">Reset your password</h2>
    <p>We received a request to reset the password for your Scholar Shelf account.</p>
    <p style="text-align:center;margin:28px 0;">
      <a href="${resetLink}"
         style="background:#1e3a5f;color:#ffffff;padding:12px 28px;border-radius:6px;
                text-decoration:none;font-weight:bold;display:inline-block;">
        Reset Password
      </a>
    </p>
    <p>Or copy and paste this link into your browser:</p>
    <p style="word-break:break-all;color:#4b5563;font-size:13px;">${resetLink}</p>
    <p style="color:#6b7280;font-size:13px;margin-top:24px;">
      This link expires in <strong>1 hour</strong>. If you did not request a
      password reset, you can safely ignore this email.
    </p>
  `;

  return sendEmail(to, "Reset your Scholar Shelf password", wrapEmail("Reset your password", body, branding));
}

// ---------------------------------------------------------------------------
// 2. Staff / Admin Invite
// ---------------------------------------------------------------------------
export async function sendInviteEmail(
  to: string,
  role: string,
  inviteLink: string,
  branding?: EmailBranding
): Promise<boolean> {
  const roleLabel = role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const body = `
    <h2 style="margin-top:0;color:#1e3a5f;">You've been invited to Scholar Shelf</h2>
    <p>You have been invited to join Scholar Shelf as a <strong>${roleLabel}</strong>.</p>
    <p>Click the button below to set up your account:</p>
    <p style="text-align:center;margin:28px 0;">
      <a href="${inviteLink}"
         style="background:#1e3a5f;color:#ffffff;padding:12px 28px;border-radius:6px;
                text-decoration:none;font-weight:bold;display:inline-block;">
        Accept Invitation
      </a>
    </p>
    <p>Or copy and paste this link into your browser:</p>
    <p style="word-break:break-all;color:#4b5563;font-size:13px;">${inviteLink}</p>
    <p style="color:#6b7280;font-size:13px;margin-top:24px;">
      This invitation expires in <strong>7 days</strong>.
    </p>
  `;

  return sendEmail(to, "Your Scholar Shelf invitation", wrapEmail("You've been invited", body, branding));
}

// ---------------------------------------------------------------------------
// 2b. School setup invite for first School Admin
// ---------------------------------------------------------------------------
export async function sendSchoolSetupInviteEmail(
  to: string,
  adminName: string,
  schoolName: string,
  inviteLink: string,
  branding?: EmailBranding
): Promise<boolean> {
  const body = `
    <h2 style="margin-top:0;color:#1e3a5f;">Complete your Scholar Shelf school setup</h2>
    <p>Hello ${adminName},</p>
    <p><strong>${schoolName}</strong> has been created in Scholar Shelf and you have been invited as the first School Admin.</p>
    <p>Use the secure link below to create your password, accept the invitation, and continue the school setup.</p>
    <p style="text-align:center;margin:28px 0;">
      <a href="${inviteLink}"
         style="background:#1e3a5f;color:#ffffff;padding:12px 28px;border-radius:6px;
                text-decoration:none;font-weight:bold;display:inline-block;">
        Continue School Setup
      </a>
    </p>
    <p>Or copy and paste this link into your browser:</p>
    <p style="word-break:break-all;color:#4b5563;font-size:13px;">${inviteLink}</p>
    <p style="color:#6b7280;font-size:13px;margin-top:24px;">
      This setup invitation expires in <strong>7 days</strong> and can only be used once.
    </p>
  `;

  return sendEmail(
    to,
    `Complete your Scholar Shelf school setup for ${schoolName}`,
    wrapEmail("Complete your Scholar Shelf school setup", body, {
      schoolName,
      logoUrl: branding?.logoUrl || null,
      primaryColour: branding?.primaryColour || null,
      secondaryColour: branding?.secondaryColour || null,
    })
  );
}

// ---------------------------------------------------------------------------
// 3. Parent Linking Code
// ---------------------------------------------------------------------------
export async function sendParentCodeEmail(
  to: string,
  studentName: string,
  linkingCode: string,
  expiresAt: Date,
  branding?: EmailBranding
): Promise<boolean> {
  const expiryStr = expiresAt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const body = `
    <h2 style="margin-top:0;color:#1e3a5f;">Your child's book linking code</h2>
    <p>A linking code has been generated for <strong>${studentName}</strong>.</p>
    <p>Use this code to connect your parent account to your child's book record on Scholar Shelf:</p>
    <p style="text-align:center;margin:28px 0;">
      <span style="background:#f0f4ff;border:2px solid #1e3a5f;border-radius:8px;
                   padding:14px 32px;font-size:28px;font-weight:bold;letter-spacing:4px;
                   color:#1e3a5f;display:inline-block;">
        ${linkingCode}
      </span>
    </p>
    <p><strong>How to use it:</strong></p>
    <ol style="padding-left:20px;color:#374151;">
      <li><strong>New to Scholar Shelf?</strong> Create a free parent account at <a href="https://scholarshelf.co.uk/register" style="color:#1e3a5f;">scholarshelf.co.uk/register</a></li>
      <li><strong>Already have an account?</strong> Sign in at <a href="https://scholarshelf.co.uk/login" style="color:#1e3a5f;">scholarshelf.co.uk/login</a></li>
      <li>Once signed in, go to <strong>Link Child</strong> in the menu</li>
      <li>Enter the code above to link your child</li>
    </ol>
    <p style="color:#6b7280;font-size:13px;margin-top:24px;">
      This code expires on <strong>${expiryStr}</strong> and can only be used once.
      If you did not expect this email, please contact your school.
    </p>
  `;

  return sendEmail(
    to,
    `Scholar Shelf: Linking code for ${studentName}`,
    wrapEmail("Your child's linking code", body, branding)
  );
}

// ---------------------------------------------------------------------------
// 4. Payment Submitted (confirmation to parent)
// ---------------------------------------------------------------------------
export async function sendPaymentSubmittedEmail(
  to: string,
  paymentReference: string,
  totalAmount: string,
  paymentMethod: string,
  branding?: EmailBranding
): Promise<boolean> {
  const methodLabel = paymentMethod.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const body = `
    <h2 style="margin-top:0;color:#1e3a5f;">Payment received — under review</h2>
    <p>Thank you! We have received your payment submission for Scholar Shelf books.</p>
    <table style="border-collapse:collapse;width:100%;margin:20px 0;font-size:14px;">
      <tr style="background:#f9fafb;">
        <td style="padding:10px 14px;border:1px solid #e5e7eb;color:#6b7280;">Reference</td>
        <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:bold;">${paymentReference}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;border:1px solid #e5e7eb;color:#6b7280;">Amount</td>
        <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:bold;">£${totalAmount}</td>
      </tr>
      <tr style="background:#f9fafb;">
        <td style="padding:10px 14px;border:1px solid #e5e7eb;color:#6b7280;">Method</td>
        <td style="padding:10px 14px;border:1px solid #e5e7eb;">${methodLabel}</td>
      </tr>
    </table>
    <p>Your school will review and confirm the payment. You will receive another email once it has been verified.</p>
    <p style="color:#6b7280;font-size:13px;margin-top:24px;">
      Please keep your reference number for your records. If you have any questions,
      contact your school directly.
    </p>
  `;

  return sendEmail(
    to,
    `Scholar Shelf: Payment submitted (Ref: ${paymentReference})`,
    wrapEmail("Payment submitted", body, branding)
  );
}

// ---------------------------------------------------------------------------
// 5. Payment Verified (admin confirms → email parent)
// ---------------------------------------------------------------------------
export async function sendPaymentVerifiedEmail(
  to: string,
  paymentReference: string,
  totalAmount: string,
  branding?: EmailBranding
): Promise<boolean> {
  const body = `
    <h2 style="margin-top:0;color:#1e3a5f;">Your payment has been verified ✓</h2>
    <p>Great news — your Scholar Shelf payment has been confirmed by your school.</p>
    <table style="border-collapse:collapse;width:100%;margin:20px 0;font-size:14px;">
      <tr style="background:#f9fafb;">
        <td style="padding:10px 14px;border:1px solid #e5e7eb;color:#6b7280;">Reference</td>
        <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:bold;">${paymentReference}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;border:1px solid #e5e7eb;color:#6b7280;">Amount</td>
        <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:bold;">£${totalAmount}</td>
      </tr>
      <tr style="background:#f9fafb;">
        <td style="padding:10px 14px;border:1px solid #e5e7eb;color:#6b7280;">Status</td>
        <td style="padding:10px 14px;border:1px solid #e5e7eb;color:#16a34a;font-weight:bold;">Verified</td>
      </tr>
    </table>
    <p>Your child's books will be prepared for distribution. You may receive further communication from your school regarding collection.</p>
    <p style="color:#6b7280;font-size:13px;margin-top:24px;">
      Thank you for using Scholar Shelf.
    </p>
  `;

  return sendEmail(
    to,
    `Scholar Shelf: Payment verified (Ref: ${paymentReference})`,
    wrapEmail("Payment verified", body, branding)
  );
}

// ---------------------------------------------------------------------------
// 6. Payment Rejected (admin rejects → email parent)
// ---------------------------------------------------------------------------
export async function sendPaymentRejectedEmail(
  to: string,
  paymentReference: string,
  totalAmount: string,
  branding?: EmailBranding
): Promise<boolean> {
  const body = `
    <h2 style="margin-top:0;color:#1e3a5f;">Payment could not be verified</h2>
    <p>Unfortunately your Scholar Shelf payment could not be verified by your school.</p>
    <table style="border-collapse:collapse;width:100%;margin:20px 0;font-size:14px;">
      <tr style="background:#f9fafb;">
        <td style="padding:10px 14px;border:1px solid #e5e7eb;color:#6b7280;">Reference</td>
        <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:bold;">${paymentReference}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;border:1px solid #e5e7eb;color:#6b7280;">Amount</td>
        <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:bold;">£${totalAmount}</td>
      </tr>
      <tr style="background:#f9fafb;">
        <td style="padding:10px 14px;border:1px solid #e5e7eb;color:#6b7280;">Status</td>
        <td style="padding:10px 14px;border:1px solid #e5e7eb;color:#dc2626;font-weight:bold;">Rejected</td>
      </tr>
    </table>
    <p>Please contact your school directly for more information and to arrange an alternative payment.</p>
    <p style="color:#6b7280;font-size:13px;margin-top:24px;">
      We apologise for any inconvenience. If you believe this is an error,
      please reach out to your school.
    </p>
  `;

  return sendEmail(
    to,
    `Scholar Shelf: Payment could not be verified (Ref: ${paymentReference})`,
    wrapEmail("Payment rejected", body, branding)
  );
}

// ---------------------------------------------------------------------------
// 7. Welcome (parent account created)
// ---------------------------------------------------------------------------
export async function sendWelcomeParentEmail(
  to: string,
  parentName: string,
  branding?: EmailBranding
): Promise<boolean> {
  const firstName = (parentName || "").trim().split(/\s+/)[0] || "there";
  const body = `
    <h2 style="margin-top:0;color:#1e3a5f;">Welcome to Scholar Shelf, ${firstName} 👋</h2>
    <p>Your parent account is ready. Scholar Shelf is where your school manages the books your child needs each year — you can link your children, review their book lists, pay, and collect, all in one place.</p>
    <p><strong>Getting started:</strong></p>
    <ol style="padding-left:20px;color:#374151;">
      <li>Sign in at <a href="https://scholarshelf.co.uk/login" style="color:#1e3a5f;">scholarshelf.co.uk/login</a></li>
      <li>Go to <strong>Link Child</strong> and enter the linking code your school sent you</li>
      <li>Review the book list and complete payment when you're ready</li>
    </ol>
    <p style="text-align:center;margin:28px 0;">
      <a href="https://scholarshelf.co.uk/login"
         style="background:#1e3a5f;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:bold;display:inline-block;">
        Go to my account
      </a>
    </p>
    <p style="color:#6b7280;font-size:13px;margin-top:24px;">
      If you didn't create this account, you can safely ignore this email.
    </p>
  `;
  return sendEmail(to, "Welcome to Scholar Shelf", wrapEmail("Welcome to Scholar Shelf", body, branding));
}

// ---------------------------------------------------------------------------
// 8. Payment instructions (order created → how to pay)
// ---------------------------------------------------------------------------
export async function sendPaymentInstructionsEmail(
  to: string,
  paymentReference: string,
  totalAmount: string,
  paymentAppName: string | null | undefined,
  branding?: EmailBranding
): Promise<boolean> {
  const appName = (paymentAppName || "").trim();
  const appLine = appName
    ? `<p>Please pay using your school's payment app: <strong>${appName}</strong>.</p>`
    : `<p>Please follow your school's usual payment method to complete this order.</p>`;

  const body = `
    <h2 style="margin-top:0;color:#1e3a5f;">Your order is ready — here's how to pay</h2>
    <p>Thanks for placing your Scholar Shelf book order. To complete it, please make your payment and then submit your reference in the app.</p>
    <table style="border-collapse:collapse;width:100%;margin:20px 0;font-size:14px;">
      <tr style="background:#f9fafb;">
        <td style="padding:10px 14px;border:1px solid #e5e7eb;color:#6b7280;">Amount due</td>
        <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:bold;">£${totalAmount}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;border:1px solid #e5e7eb;color:#6b7280;">Payment reference</td>
        <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:bold;">${paymentReference}</td>
      </tr>
    </table>
    ${appLine}
    <p><strong>Important:</strong> use the payment reference <strong>${paymentReference}</strong> so your school can match your payment to your order.</p>
    <p style="text-align:center;margin:28px 0;">
      <a href="https://scholarshelf.co.uk/login"
         style="background:#1e3a5f;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:bold;display:inline-block;">
        Submit my payment reference
      </a>
    </p>
    <p style="color:#6b7280;font-size:13px;margin-top:24px;">
      Once you've paid, sign in and submit your reference so your school can confirm it.
      You'll get an email when your payment is verified.
    </p>
  `;
  return sendEmail(
    to,
    `Scholar Shelf: Payment instructions (Ref: ${paymentReference})`,
    wrapEmail("How to pay", body, branding)
  );
}

// ---------------------------------------------------------------------------
// 9. Books ready for collection
// ---------------------------------------------------------------------------
export async function sendBooksReadyForCollectionEmail(
  to: string,
  paymentReference: string,
  branding?: EmailBranding
): Promise<boolean> {
  const schoolName = (branding?.schoolName || "").trim();
  const whereLine = schoolName
    ? `Your books are ready to collect from <strong>${schoolName}</strong>.`
    : `Your books are ready to collect from your school.`;
  const body = `
    <h2 style="margin-top:0;color:#1e3a5f;">Your books are ready to collect 📚</h2>
    <p>${whereLine}</p>
    <table style="border-collapse:collapse;width:100%;margin:20px 0;font-size:14px;">
      <tr style="background:#f9fafb;">
        <td style="padding:10px 14px;border:1px solid #e5e7eb;color:#6b7280;">Order reference</td>
        <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:bold;">${paymentReference}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;border:1px solid #e5e7eb;color:#6b7280;">Status</td>
        <td style="padding:10px 14px;border:1px solid #e5e7eb;color:#16a34a;font-weight:bold;">Ready for collection</td>
      </tr>
    </table>
    <p>Please bring your order reference when collecting. Your school will let you know their collection times if you're unsure.</p>
    <p style="color:#6b7280;font-size:13px;margin-top:24px;">
      Thank you for using Scholar Shelf.
    </p>
  `;
  return sendEmail(
    to,
    `Scholar Shelf: Your books are ready to collect (Ref: ${paymentReference})`,
    wrapEmail("Ready for collection", body, branding)
  );
}

// ---------------------------------------------------------------------------
// 10. Collection completed (receipt)
// ---------------------------------------------------------------------------
export async function sendCollectionCompletedEmail(
  to: string,
  paymentReference: string,
  totalAmount: string,
  branding?: EmailBranding
): Promise<boolean> {
  const collectedOn = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const body = `
    <h2 style="margin-top:0;color:#1e3a5f;">Books collected — you're all set ✓</h2>
    <p>This confirms your Scholar Shelf books have been collected. Keep this email as your receipt.</p>
    <table style="border-collapse:collapse;width:100%;margin:20px 0;font-size:14px;">
      <tr style="background:#f9fafb;">
        <td style="padding:10px 14px;border:1px solid #e5e7eb;color:#6b7280;">Order reference</td>
        <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:bold;">${paymentReference}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;border:1px solid #e5e7eb;color:#6b7280;">Amount paid</td>
        <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:bold;">£${totalAmount}</td>
      </tr>
      <tr style="background:#f9fafb;">
        <td style="padding:10px 14px;border:1px solid #e5e7eb;color:#6b7280;">Collected on</td>
        <td style="padding:10px 14px;border:1px solid #e5e7eb;">${collectedOn}</td>
      </tr>
    </table>
    <p style="color:#6b7280;font-size:13px;margin-top:24px;">
      If anything looks wrong with your order, please contact your school directly.
    </p>
  `;
  return sendEmail(
    to,
    `Scholar Shelf: Books collected — receipt (Ref: ${paymentReference})`,
    wrapEmail("Collection complete", body, branding)
  );
}
