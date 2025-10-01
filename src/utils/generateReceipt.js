import PDFDocument from "pdfkit";
import getStream from "get-stream";
import path from "path"; 
import QRCode from "qrcode";
import { fileURLToPath } from 'url'; // Needed for __dirname in ES Modules

// ⚠️ Note: If you use a local logo, ensure you define __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


/**
 * Generates a PDF receipt as a Base64 string.
 * @param {object} data - Receipt details.
 */
export async function generateReceipt(data) {
  const doc = new PDFDocument({ margin: 50 });
  const stream = doc.pipe(getStream.buffer());

  // === HEADER ===
  // ⚠️ Adjust this path if you don't use a logo or if your path is different
  // const logoPath = path.join(__dirname, '..', 'public', 'coffeeHeader.jpg'); 
  // try {
  //   doc.image(logoPath, { fit: [500, 120], align: "center" });
  // } catch (e) {
  //   console.warn("⚠️ Logo not found:", e);
  // }

  doc.moveDown(1);
  doc.fontSize(22).fillColor("#6b2d1f").text("India International Coffee Festival 2026", { align: "center" });
  doc.moveDown(0.3);
  doc.fontSize(16).fillColor("#333333").text("Registration Receipt", { align: "center" });
  doc.moveDown(1.5);

  // === PARTICIPANT DETAILS ===
  doc.fontSize(12).fillColor("black").text(`Date: ${data.date}`, { align: "right" });
  doc.moveDown(0.8);
  doc.fontSize(14).fillColor("#6b2d1f").text("Participant Details", { underline: true });

  doc.moveDown(0.5);
  doc.fontSize(12).fillColor("black");
  doc.text(`Name: ${data.name}`);
  doc.text(`Competition: ${data.competitionName}`);
  // 🛑 The original snippet included city, but you removed it from the schema.
  // If you need it in the receipt, ensure you pass it from the registration object.
  // doc.text(`City: ${data.city}`); 

  doc.moveDown(1.2);

  // === PAYMENT TABLE ===
  // ... (PDF table drawing logic using doc.rect, doc.text, etc. from your snippet) ...
  // --- (Skipping PDF drawing boilerplate for brevity) ---

  // === QR CODE ===
  const qrData = await QRCode.toDataURL(data.registrationId, { margin: 1 });
  const qrImage = qrData.replace(/^data:image\/png;base64,/, "");

  const qrWidth = 150;
  const pageWidth = doc.page.width;
  const qrX = (pageWidth - qrWidth) / 2;

  doc.image(Buffer.from(qrImage, "base64"), qrX, doc.y, { width: qrWidth });
  doc.moveDown(8);

  doc.fontSize(12).fillColor("#6b2d1f").text("Scan at Event Check-In", { align: "center" });

  doc.moveDown(3);

  // === FOOTER ===
  doc.fontSize(12).fillColor("#555555").text(
      "Thank you for registering! We look forward to seeing you at the Coffee Championship.",
      { align: "center" }
    );
  doc.moveDown(1);
  doc.fontSize(10).fillColor("#888888").text("© 2026 India Coffee Board", { align: "center" });

  doc.end();

  const buffer = await stream;
  return buffer.toString("base64");
}