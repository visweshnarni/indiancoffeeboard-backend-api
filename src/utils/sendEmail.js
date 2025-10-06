// utils/sendEmail.js

import { SendMailClient } from "zeptomail";
import dotenv from "dotenv";

// dotenv.config(); // Already loaded in main server

const ZEPTO_URL = process.env.ZEPTO_URL;
const ZEPTO_TOKEN = process.env.ZEPTO_TOKEN;
const ZEPTO_FROM_ADDRESS = process.env.ZEPTO_FROM;

const client = new SendMailClient({
    url: ZEPTO_URL,
    token: ZEPTO_TOKEN,
});

/**
 * Send Registration Confirmation Email using ZeptoMail Template
 * @param {Object} params
 * @param {string} params.to - Recipient email
 * @param {string} params.name - Recipient name
 * @param {string} params.templateKey - ZeptoMail template key
 * @param {Object} params.mergeInfo - Merge variables for the template
 */
const sendEmailWithTemplate = async ({ to, name, templateKey, mergeInfo }) => {
    if (!ZEPTO_URL || !ZEPTO_TOKEN || !ZEPTO_FROM_ADDRESS) {
        console.error("❌ ZeptoMail credentials not configured.");
        throw new Error("ZeptoMail configuration missing.");
    }

    try {
        const response = await client.sendMailWithTemplate({
            mail_template_key: templateKey,
            from: {
                address: ZEPTO_FROM_ADDRESS,
                name: "NCC 2025 Team", // Updated brand name
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

        console.log(`✅ Registration email sent to ${to}`);
        return response;
    } catch (error) {
        console.error("❌ ZeptoMail sendEmailWithTemplate error:", error);
        if (error.data) console.error("ZeptoMail API Details:", error.data);
        throw error;
    }
};

export default sendEmailWithTemplate;
