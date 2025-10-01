import { sendZeptoMail } from "./zeptoMail.js";
import { generateReceipt } from "./generateReceipt.js";

/**
 * Generates PDF receipt and sends confirmation email.
 * @param {object} data - Registration and payment data.
 */
export default async function sendConfirmation(data) {
  if (!data.email) {
    console.warn("⚠️ Customer email missing, skipping confirmation.");
    return;
  }
  
  // 🛑 NOTE: The original Next.js snippet passed city, but you removed it from the model.
  // If you need it in the email/receipt, you must retrieve it from the database or mock it.
  const cityDisplay = data.city ? data.city.toUpperCase() + " Chapter" : "Local Chapter";

  const html = `
    <div style="font-family: Arial, sans-serif; padding: 16px;">
      <h2>✅ Registration Successful</h2>
      <p>Dear ${data.name},</p>
      <p>Thank you for registering for the <b>${data.competitionName}</b> at the 
      <b>${cityDisplay}</b>.</p>
      
      <p><b>Registration ID:</b> ${data.registrationId}</p>
      <p><b>Payment ID:</b> ${data.paymentId}</p>
      <p><b>Amount Paid:</b> ₹ ${data.amount}</p>
      
      <p>Please find your receipt attached as a PDF.</p>
      <p>- Coffee Championship Team</p>
    </div>
  `;

  // Generate the PDF and get the Base64 content
  const pdfBase64 = await generateReceipt({
    ...data,
    date: new Date().toLocaleDateString('en-IN'),
  });

  return sendZeptoMail({
    to: data.email,
    subject: "Registration Confirmation - Coffee Championship",
    html,
    attachments: [
      {
        name: `Receipt-${data.registrationId}.pdf`,
        content: pdfBase64,
      },
    ],
  });
}