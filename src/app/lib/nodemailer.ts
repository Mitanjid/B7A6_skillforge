import config from "../config/index.js";

interface ISendMailPayload {
  from?: string;
  to: string;
  subject: string;
  html: string;
}

// Render's free tier blocks outbound SMTP (ports 25/465/587), so the old
// nodemailer/Gmail transport could never connect there. This keeps the exact
// `transporter.sendMail({ from, to, subject, html })` shape every module
// already calls, but delivers through Resend's HTTPS API instead (port 443,
// never blocked) — so no call sites needed to change.
export const transporter = {
  sendMail: async ({ from, to, subject, html }: ISendMailPayload) => {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.resend_api_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: from ?? config.email_sender,
        to,
        subject,
        html,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Resend API error (${response.status}): ${await response.text()}`,
      );
    }

    return response.json();
  },
};

if (config.resend_api_key) {
  console.log("Resend email client ready");
} else {
  console.error("RESEND_API_KEY is not set — emails will fail to send");
}
