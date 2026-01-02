const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const generateKPIReviewPDF = async (reviewData, kpiData, employeeData, managerData) => {
  return new Promise((resolve, reject) => {
    try {
      // Create PDF directory if it doesn't exist
      const pdfDir = path.join(__dirname, '../uploads/pdfs');
      if (!fs.existsSync(pdfDir)) {
        fs.mkdirSync(pdfDir, { recursive: true });
      }

      const fileName = `kpi-review-${reviewData.id}-${Date.now()}.pdf`;
      const filePath = path.join(pdfDir, fileName);

      const doc = new PDFDocument({ margin: 50 });

      // Pipe to file
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Header
      doc.fontSize(20).text('KPI Performance Review', { align: 'center' });
      doc.moveDown();
      doc.fontSize(14).text(`Review Period: ${reviewData.review_period} ${reviewData.review_quarter || ''} ${reviewData.review_year}`, { align: 'center' });
      doc.moveDown(2);

      // Employee Information
      doc.fontSize(16).text('Employee Information', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12);
      doc.text(`Name: ${employeeData.name}`);
      doc.text(`Position: ${employeeData.position || 'N/A'}`);
      doc.text(`Department: ${employeeData.department || 'N/A'}`);
      doc.text(`Payroll Number: ${employeeData.payroll_number}`);
      doc.moveDown();

      // Manager Information
      doc.fontSize(16).text('Manager Information', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12);
      doc.text(`Name: ${managerData.name}`);
      doc.text(`Position: ${managerData.position || 'N/A'}`);
      doc.moveDown(2);

      // KPI Review Details
      doc.fontSize(16).text('KPI Review Details', { underline: true });
      doc.moveDown(0.5);

      kpiData.forEach((kpi, index) => {
        doc.fontSize(14).text(`${index + 1}. ${kpi.title}`, { underline: true });
        doc.moveDown(0.3);
        doc.fontSize(11);
        doc.text(`Description: ${kpi.description || 'N/A'}`);
        doc.text(`Target Value: ${kpi.target_value} ${kpi.measure_unit}`);
        doc.moveDown(0.3);
        
        if (reviewData.employee_rating) {
          doc.text(`Employee Self-Rating: ${reviewData.employee_rating}/5`);
        }
        if (reviewData.employee_comment) {
          doc.text(`Employee Comment: ${reviewData.employee_comment}`);
        }
        doc.moveDown(0.3);
        
        if (reviewData.manager_rating) {
          doc.text(`Manager Rating: ${reviewData.manager_rating}/5`);
        }
        if (reviewData.manager_comment) {
          doc.text(`Manager Comment: ${reviewData.manager_comment}`);
        }
        doc.moveDown(1);
      });

      // Overall Manager Comments
      if (reviewData.overall_manager_comment) {
        doc.fontSize(16).text('Overall Manager Comments', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(12).text(reviewData.overall_manager_comment);
        doc.moveDown(2);
      }

      // Signatures
      doc.fontSize(16).text('Signatures', { underline: true });
      doc.moveDown(1);
      
      doc.fontSize(11);
      doc.text('Employee Signature:', { continued: true });
      doc.text(employeeData.name, { align: 'right' });
      if (reviewData.employee_signed_at) {
        doc.text(`Date: ${new Date(reviewData.employee_signed_at).toLocaleDateString()}`, { align: 'right' });
      }
      doc.moveDown(1.5);
      
      doc.text('Manager Signature:', { continued: true });
      doc.text(managerData.name, { align: 'right' });
      if (reviewData.manager_signed_at) {
        doc.text(`Date: ${new Date(reviewData.manager_signed_at).toLocaleDateString()}`, { align: 'right' });
      }

      // Footer
      doc.fontSize(10).text(
        `Generated on: ${new Date().toLocaleString()}`,
        { align: 'center' }
      );

      doc.end();

      stream.on('finish', () => {
        resolve({ filePath, fileName });
      });

      stream.on('error', (error) => {
        reject(error);
      });
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = { generateKPIReviewPDF };

