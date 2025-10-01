import { SendMailClient } from "zeptomail";
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.ZEPTO_URL;
const token = process.env.ZEPTO_TOKEN;
const fromEmail = process.env.ZEPTO_FROM;

export const zeptoClient = new SendMailClient({ url, token });

/**
 * Sends an email using ZeptoMail.
 * @param {object} options
 * @param {string} options.to - Recipient email address.
 * @param {string} options.subject - Email subject.
 * @param {string} options.html - HTML body content.
 * @param {Array<object>} [options.attachments] - Array of file attachments.
 */
export async function sendZeptoMail({
  to,
  subject,
  html,
  attachments,
}) {
  if (!to || !subject || !html) {
    console.error("❌ ZeptoMail: Mandatory field missing", { to, subject, html });
    throw new Error("TM_3201: Mandatory field missing (to, subject, htmlbody)");
  }

  try {
    const response = await zeptoClient.sendMail({
      from: {
        address: fromEmail,
        name: "Coffee Championship",
      },
      to: [
        {
          email_address: { address: to },
        },
      ],
      subject,
      htmlbody: html,
      ...(attachments && {
        attachments: attachments.map((att) => ({
          name: att.name,
          content: att.content,
          mime_type: "application/pdf", // Assuming PDF type for receipt
        })),
      }),
    });

    console.log(`✅ Email sent to ${to}. ZeptoMail Response:`, response);
    return { success: true };
  } catch (err) {
    console.error("❌ ZeptoMail Error:", err);
    return { success: false, error: err };
  }
}