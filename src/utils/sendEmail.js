// utils/sendEmail.js

import { SendMailClient } from "zeptomail";
import dotenv from "dotenv";

// NOTE: It is better to rely on the main server file to call dotenv.config()
// But including it here ensures the utility works standalone if needed.
// dotenv.config(); 

// Use environment variables for configuration
const ZEPTO_URL = process.env.ZEPTO_URL;
const ZEPTO_TOKEN = process.env.ZEPTO_TOKEN;
const ZEPTO_FROM_ADDRESS = process.env.ZEPTO_FROM;

// Initialize ZeptoMail client
const client = new SendMailClient({
  url: ZEPTO_URL,
  token: ZEPTO_TOKEN,
});

/**
 * Send Registration Confirmation Email using ZeptoMail Template
 * @param {Object} params
 * @param {string} params.to - Recipient email (registration.email)
 * @param {string} params.name - Recipient name (registration.name)
 * @param {string} params.templateKey - ZeptoMail template key (IICF 2025 template)
 * @param {Object} params.mergeInfo - Merge variables for the template
 */
const sendEmailWithTemplate = async ({ to, name, templateKey, mergeInfo }) => {
  if (!ZEPTO_URL || !ZEPTO_TOKEN || !ZEPTO_FROM_ADDRESS) {
    console.error("❌ ZeptoMail credentials are not configured in environment variables.");
    throw new Error("ZeptoMail configuration missing.");
  }

  try {
    const response = await client.sendMailWithTemplate({
      mail_template_key: templateKey,
      from: {
        address: ZEPTO_FROM_ADDRESS,
        name: "IICF 2025 Team", // ⭐️ MODIFIED BRAND NAME ⭐️
      },
      to: [
        {
          email_address: {
            address: to,
            name,
          },
        },
      ],
      merge_info: mergeInfo,
    });

    console.log(`✅ Registration email sent successfully to ${to}`);
    return response;
  } catch (error) {
    console.error("❌ ZeptoMail sendEmailWithTemplate error:", error);
    // Log more detailed error if possible
    if (error.data) console.error("ZeptoMail API Details:", error.data);
    throw error;
  }
};

export default sendEmailWithTemplate;