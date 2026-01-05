const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Helper function to convert base64 image to buffer
const base64ToBuffer = (base64String) => {
  if (!base64String) return null;
  // Remove data URL prefix if present (e.g., "data:image/png;base64,")
  const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
  return Buffer.from(base64Data, 'base64');
};

// Generate PDF for acknowledged KPIs (before review)
const generateAcknowledgedKPIPDF = async (kpiData, kpiItems, employeeData, managerData) => {
  return new Promise((resolve, reject) => {
    try {
      // Create PDF directory if it doesn't exist
      const pdfDir = path.join(__dirname, '../uploads/pdfs');
      if (!fs.existsSync(pdfDir)) {
        fs.mkdirSync(pdfDir, { recursive: true });
      }

      const fileName = `kpi-acknowledged-${kpiData.id}-${Date.now()}.pdf`;
      const filePath = path.join(pdfDir, fileName);

      const doc = new PDFDocument({ margin: 50, size: 'A4' });

      // Pipe to file
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Header with colored background
      doc.rect(50, 50, 500, 60).fillAndStroke('#4F46E5', '#000000'); // Purple background
      doc.fillColor('#FFFFFF').fontSize(20).font('Helvetica-Bold');
      doc.text('KPI Acknowledgement Document', 50, 65, { width: 500, align: 'center' });
      doc.fontSize(14).font('Helvetica');
      doc.text(
        `Period: ${kpiData.period === 'quarterly' ? 'Quarterly' : 'Yearly'} - ${kpiData.quarter || ''} ${kpiData.year}`,
        50, 85, { width: 500, align: 'center' }
      );
      doc.fillColor('#000000');
      doc.y = 120;

      // Employee Information Box
      doc.rect(50, doc.y, 240, 80).fillAndStroke('#DBEAFE', '#1E40AF'); // Light blue background
      doc.fillColor('#1E40AF').fontSize(14).font('Helvetica-Bold');
      doc.text('Employee Information', 55, doc.y + 5);
      doc.fillColor('#000000').fontSize(11).font('Helvetica');
      doc.text(`Name: ${employeeData.name || 'N/A'}`, 55, doc.y + 20);
      doc.text(`Position: ${employeeData.position || 'N/A'}`, 55, doc.y + 32);
      doc.text(`Department: ${employeeData.department || 'N/A'}`, 55, doc.y + 44);
      doc.text(`Payroll: ${employeeData.payroll_number || 'N/A'}`, 55, doc.y + 56);
      if (kpiData.meeting_date) {
        doc.text(`Meeting: ${new Date(kpiData.meeting_date).toLocaleDateString()}`, 55, doc.y + 68);
      }
      doc.y += 90;

      // Manager Information Box
      doc.rect(310, doc.y - 90, 240, 80).fillAndStroke('#F3E8FF', '#7C3AED'); // Light purple background
      doc.fillColor('#7C3AED').fontSize(14).font('Helvetica-Bold');
      doc.text('Manager Information', 315, doc.y - 85);
      doc.fillColor('#000000').fontSize(11).font('Helvetica');
      doc.text(`Name: ${managerData.name || 'N/A'}`, 315, doc.y - 70);
      doc.text(`Position: ${managerData.position || 'N/A'}`, 315, doc.y - 58);
      doc.y += 10;

      // KPI Items Table
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#1E40AF').text('KPI Items', { underline: true });
      doc.fillColor('#000000');
      doc.moveDown(0.5);

      if (kpiItems.length > 0) {
        // Table dimensions - A4 page width is 595 points, with 50 margin each side = 495 available
        const tableTop = doc.y;
        const rowHeight = 30; // Increased for better readability
        // Column widths proportionally adjusted to fit within 495 points
        const colWidths = [25, 90, 110, 75, 60, 55, 75, 55]; // Total: 545, but we'll use landscape or scale
        const tableLeft = 50;
        const tableWidth = 495; // Fixed width to fit page
        const scaleFactor = tableWidth / colWidths.reduce((sum, w) => sum + w, 0);
        const scaledWidths = colWidths.map(w => w * scaleFactor);
        
        // Header row with purple background
        doc.rect(tableLeft, tableTop, tableWidth, rowHeight).fillAndStroke('#4F46E5', '#1E1B4B');
        doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold');
        
        const headers = ['#', 'KPI TITLE', 'DESCRIPTION', 'CURRENT PERFORMANCE STATUS', 'TARGET VALUE', 'MEASURE UNIT', 'EXPECTED COMPLETION DATE', 'GOAL WEIGHT'];
        let xPos = tableLeft + 3;
        headers.forEach((header, i) => {
          doc.text(header.toUpperCase(), xPos, tableTop + 8, { width: scaledWidths[i] - 6, align: 'left' });
          xPos += scaledWidths[i];
        });
        
        doc.fillColor('#000000');
        let currentY = tableTop + rowHeight;
        
        // Data rows
        kpiItems.forEach((item, index) => {
          // Alternate row colors for better readability
          if (index % 2 === 0) {
            doc.rect(tableLeft, currentY, tableWidth, rowHeight).fillColor('#F9FAFB').fill();
          } else {
            doc.rect(tableLeft, currentY, tableWidth, rowHeight).fillColor('#FFFFFF').fill();
          }
          doc.fillColor('#000000');
          
          // Draw row border
          doc.rect(tableLeft, currentY, tableWidth, rowHeight).stroke();
          
          xPos = tableLeft + 3;
          doc.fontSize(8).font('Helvetica');
          
          // Row data - handle long text by wrapping
          const rowData = [
            String(index + 1),
            item.title || 'N/A',
            item.description || 'N/A',
            item.current_performance_status || 'N/A',
            item.target_value || 'N/A',
            item.measure_unit || 'N/A',
            item.expected_completion_date ? new Date(item.expected_completion_date).toLocaleDateString() : 'N/A',
            item.goal_weight || 'N/A'
          ];
          
          rowData.forEach((data, i) => {
            const cellText = String(data);
            // For description column, allow more text
            doc.text(cellText, xPos, currentY + 5, { 
              width: scaledWidths[i] - 6, 
              align: 'left',
              ellipsis: true
            });
            xPos += scaledWidths[i];
          });
          
          currentY += rowHeight;
          
          // Add new page if needed (leave space for signatures)
          if (currentY > 650) {
            doc.addPage();
            currentY = 50;
          }
        });
        
        // Draw bottom border
        doc.rect(tableLeft, currentY, tableWidth, 0).stroke();
        doc.y = currentY + 15;
      } else {
        doc.fontSize(11).font('Helvetica').fillColor('#6B7280').text('No KPI items found.', { italic: true });
        doc.fillColor('#000000');
        doc.moveDown();
      }

      // Signatures Section
      doc.addPage();
      doc.fontSize(16).font('Helvetica-Bold').text('Signatures', { underline: true });
      doc.moveDown(2);

      // Employee Signature Box
      doc.rect(50, doc.y, 240, 120).fillAndStroke('#DBEAFE', '#1E40AF');
      doc.fillColor('#1E40AF').fontSize(12).font('Helvetica-Bold');
      doc.text('Employee Signature', 55, doc.y + 5);
      doc.fillColor('#000000');
      doc.y += 20;
      
      // IMPORTANT: Use signature from KPI (acknowledgement) first
      // This is the signature drawn directly when employee acknowledged in KPIAcknowledgement.tsx
      // Fall back to user profile signature if not available
      const employeeSignature = kpiData.employee_signature || employeeData.signature;
      console.log('Employee signature check:', {
        fromKPI: !!kpiData.employee_signature,
        fromUser: !!employeeData.signature,
        kpiId: kpiData.id
      });
      if (employeeSignature) {
        try {
          const signatureBuffer = base64ToBuffer(employeeSignature);
          if (signatureBuffer) {
            doc.image(signatureBuffer, {
              fit: [220, 60],
              align: 'left',
              x: 55,
              y: doc.y
            });
            doc.y += 65;
          }
        } catch (err) {
          console.error('Error adding employee signature:', err);
          doc.fontSize(10).font('Helvetica').fillColor('#DC2626').text('Signature image unavailable', { italic: true });
          doc.fillColor('#000000');
          doc.y += 20;
        }
      } else {
        doc.fontSize(10).font('Helvetica').fillColor('#DC2626').text('No signature provided', { italic: true });
        doc.fillColor('#000000');
        doc.y += 20;
      }
      
      doc.fontSize(10).font('Helvetica');
      doc.text(`Name: ${employeeData.name || 'N/A'}`, 55, doc.y);
      doc.y += 12;
      if (kpiData.employee_signed_at) {
        doc.text(`Date: ${new Date(kpiData.employee_signed_at).toLocaleDateString()}`, 55, doc.y);
        doc.y += 12;
      }
      doc.y += 10;

      // Manager Signature Box
      doc.rect(310, doc.y - 120, 240, 120).fillAndStroke('#F3E8FF', '#7C3AED');
      doc.fillColor('#7C3AED').fontSize(12).font('Helvetica-Bold');
      doc.text('Manager Signature', 315, doc.y - 115);
      doc.fillColor('#000000');
      const managerSignatureY = doc.y - 95;
      doc.y = managerSignatureY;
      
      // Use signature from KPI (setting) or from user profile
      // IMPORTANT: Check kpiData.manager_signature first (from kpis table when KPI was created)
      const managerSignature = kpiData.manager_signature || managerData.signature;
      console.log('Manager signature check:', {
        fromKPI: !!kpiData.manager_signature,
        fromUser: !!managerData.signature,
        kpiId: kpiData.id
      });
      
      if (managerSignature) {
        try {
          const signatureBuffer = base64ToBuffer(managerSignature);
          if (signatureBuffer) {
            doc.image(signatureBuffer, {
              fit: [220, 60],
              align: 'left',
              x: 315,
              y: doc.y
            });
            doc.y += 65;
          }
        } catch (err) {
          console.error('Error adding manager signature:', err);
          doc.fontSize(10).font('Helvetica').fillColor('#DC2626').text('Signature image unavailable', { italic: true });
          doc.fillColor('#000000');
          doc.y += 20;
        }
      } else {
        doc.fontSize(10).font('Helvetica').fillColor('#DC2626').text('No signature provided', { italic: true });
        doc.fillColor('#000000');
        doc.y += 20;
      }
      
      doc.fontSize(10).font('Helvetica');
      doc.text(`Name: ${managerData.name || 'N/A'}`, 315, doc.y);
      doc.y += 12;
      if (kpiData.manager_signed_at) {
        doc.text(`Date: ${new Date(kpiData.manager_signed_at).toLocaleDateString()}`, 315, doc.y);
        doc.y += 12;
      }

      // Footer
      doc.fontSize(10).font('Helvetica').text(
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

      // Signatures Section
      doc.addPage();
      doc.fontSize(16).font('Helvetica-Bold').text('Signatures', { underline: true });
      doc.moveDown(2);

      // Employee Signature
      doc.fontSize(12).font('Helvetica-Bold').text('Employee Signature:', { continued: false });
      doc.moveDown(0.5);
      
      // Try to get employee signature from review or employee data
      const employeeSignature = reviewData.employee_signature || employeeData.signature;
      if (employeeSignature) {
        try {
          const signatureBuffer = base64ToBuffer(employeeSignature);
          if (signatureBuffer) {
            doc.image(signatureBuffer, {
              fit: [200, 80],
              align: 'left'
            });
          }
        } catch (err) {
          console.error('Error adding employee signature:', err);
          doc.fontSize(11).font('Helvetica').text('Signature image unavailable', { italic: true });
        }
      } else {
        doc.fontSize(11).font('Helvetica').text('No signature provided', { italic: true });
      }
      
      doc.moveDown(0.5);
      doc.fontSize(11).font('Helvetica');
      doc.text(`Employee Name: ${employeeData.name || 'N/A'}`);
      if (reviewData.employee_signed_at) {
        doc.text(`Date: ${new Date(reviewData.employee_signed_at).toLocaleDateString()}`);
      }
      doc.moveDown(2);

      // Manager Signature
      doc.fontSize(12).font('Helvetica-Bold').text('Manager Signature:', { continued: false });
      doc.moveDown(0.5);
      
      // Try to get manager signature from review or manager data
      const managerSignature = reviewData.manager_signature || managerData.signature;
      if (managerSignature) {
        try {
          const signatureBuffer = base64ToBuffer(managerSignature);
          if (signatureBuffer) {
            doc.image(signatureBuffer, {
              fit: [200, 80],
              align: 'left'
            });
          }
        } catch (err) {
          console.error('Error adding manager signature:', err);
          doc.fontSize(11).font('Helvetica').text('Signature image unavailable', { italic: true });
        }
      } else {
        doc.fontSize(11).font('Helvetica').text('No signature provided', { italic: true });
      }
      
      doc.moveDown(0.5);
      doc.fontSize(11).font('Helvetica');
      doc.text(`Manager Name: ${managerData.name || 'N/A'}`);
      if (reviewData.manager_signed_at) {
        doc.text(`Date: ${new Date(reviewData.manager_signed_at).toLocaleDateString()}`);
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

// Generate PDF for completed KPI reviews (with all review information)
const generateCompletedReviewPDF = async (kpiData, kpiItems, reviewData, employeeData, managerData) => {
  return new Promise((resolve, reject) => {
    try {
      // Create PDF directory if it doesn't exist
      const pdfDir = path.join(__dirname, '../uploads/pdfs');
      if (!fs.existsSync(pdfDir)) {
        fs.mkdirSync(pdfDir, { recursive: true });
      }

      const fileName = `kpi-review-completed-${kpiData.id}-${Date.now()}.pdf`;
      const filePath = path.join(pdfDir, fileName);

      const doc = new PDFDocument({ margin: 50, size: 'A4' });

      // Pipe to file
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Header with colored background
      doc.rect(50, 50, 500, 60).fillAndStroke('#4F46E5', '#000000'); // Purple background
      doc.fillColor('#FFFFFF').fontSize(20).font('Helvetica-Bold');
      doc.text('KPI Performance Review - Completed', 50, 65, { width: 500, align: 'center' });
      doc.fontSize(14).font('Helvetica');
      doc.text(
        `Period: ${kpiData.period === 'quarterly' ? 'Quarterly' : 'Yearly'} - ${kpiData.quarter || ''} ${kpiData.year}`,
        50, 85, { width: 500, align: 'center' }
      );
      doc.fillColor('#000000');
      doc.y = 120;

      // Employee Information Box
      doc.rect(50, doc.y, 240, 80).fillAndStroke('#DBEAFE', '#1E40AF'); // Light blue background
      doc.fillColor('#1E40AF').fontSize(14).font('Helvetica-Bold');
      doc.text('Employee Information', 55, doc.y + 5);
      doc.fillColor('#000000').fontSize(11).font('Helvetica');
      doc.text(`Name: ${employeeData.name || 'N/A'}`, 55, doc.y + 20);
      doc.text(`Position: ${employeeData.position || 'N/A'}`, 55, doc.y + 32);
      doc.text(`Department: ${employeeData.department || 'N/A'}`, 55, doc.y + 44);
      doc.text(`Payroll: ${employeeData.payroll_number || 'N/A'}`, 55, doc.y + 56);
      if (kpiData.meeting_date) {
        doc.text(`Meeting: ${new Date(kpiData.meeting_date).toLocaleDateString()}`, 55, doc.y + 68);
      }
      doc.y += 90;

      // Manager Information Box
      doc.rect(310, doc.y - 90, 240, 80).fillAndStroke('#F3E8FF', '#7C3AED'); // Light purple background
      doc.fillColor('#7C3AED').fontSize(14).font('Helvetica-Bold');
      doc.text('Manager Information', 315, doc.y - 85);
      doc.fillColor('#000000').fontSize(11).font('Helvetica');
      doc.text(`Name: ${managerData.name || 'N/A'}`, 315, doc.y - 70);
      doc.text(`Position: ${managerData.position || 'N/A'}`, 315, doc.y - 58);
      if (reviewData.manager_signed_at) {
        doc.text(`Review Date: ${new Date(reviewData.manager_signed_at).toLocaleDateString()}`, 315, doc.y - 46);
      }
      doc.y += 10;

      // Parse employee and manager ratings/comments from JSON
      let employeeItemRatings = {};
      let employeeItemComments = {};
      let managerItemRatings = {};
      let managerItemComments = {};

      try {
        const empData = JSON.parse(reviewData.employee_comment || '{}');
        if (empData.items && Array.isArray(empData.items)) {
          empData.items.forEach((item) => {
            if (item.item_id) {
              employeeItemRatings[item.item_id] = item.rating || 0;
              employeeItemComments[item.item_id] = item.comment || '';
            }
          });
        }
      } catch {
        // Not JSON, use legacy format
      }

      try {
        const mgrData = JSON.parse(reviewData.manager_comment || '{}');
        if (mgrData.items && Array.isArray(mgrData.items)) {
          mgrData.items.forEach((item) => {
            if (item.item_id) {
              managerItemRatings[item.item_id] = item.rating || 0;
              managerItemComments[item.item_id] = item.comment || '';
            }
          });
        }
      } catch {
        // Not JSON, use legacy format
      }

      // KPI Review Items Table
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#1E40AF').text('KPI Review & Rating', { underline: true });
      doc.fillColor('#000000');
      doc.moveDown(0.5);

      if (kpiItems.length > 0) {
        // Split into two tables: Basic Info + Ratings & Comments
        // Table 1: Basic KPI Information (8 columns)
        const tableTop = doc.y;
        const rowHeight = 30;
        const tableLeft = 50;
        const tableWidth = 495; // A4 width minus margins
        
        // Table 1: Basic KPI Information
        const colWidths1 = [30, 110, 130, 90, 75, 70, 90, 70]; // Total: 665, but we'll scale to fit
        const totalWidth1 = colWidths1.reduce((sum, w) => sum + w, 0);
        const scaleFactor1 = tableWidth / totalWidth1;
        const scaledWidths1 = colWidths1.map(w => Math.floor(w * scaleFactor1));
        const tableWidth1 = scaledWidths1.reduce((sum, w) => sum + w, 0);
        
        // Header row for Table 1
        doc.rect(tableLeft, tableTop, tableWidth1, rowHeight).fillAndStroke('#4F46E5', '#1E1B4B');
        doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold');
        
        const headers1 = ['#', 'KPI TITLE', 'DESCRIPTION', 'CURRENT PERFORMANCE STATUS', 'TARGET VALUE', 'MEASURE UNIT', 'EXPECTED COMPLETION DATE', 'GOAL WEIGHT'];
        let xPos = tableLeft + 3;
        headers1.forEach((header, i) => {
          doc.text(header.toUpperCase(), xPos, tableTop + 8, { width: scaledWidths1[i] - 6, align: 'left' });
          xPos += scaledWidths1[i];
        });
        
        doc.fillColor('#000000');
        let currentY = tableTop + rowHeight;
        
        // Data rows for Table 1
        kpiItems.forEach((item, index) => {
          if (index % 2 === 0) {
            doc.rect(tableLeft, currentY, tableWidth1, rowHeight).fillColor('#F9FAFB').fill();
          } else {
            doc.rect(tableLeft, currentY, tableWidth1, rowHeight).fillColor('#FFFFFF').fill();
          }
          doc.fillColor('#000000');
          doc.rect(tableLeft, currentY, tableWidth1, rowHeight).stroke();
          
          xPos = tableLeft + 3;
          doc.fontSize(8).font('Helvetica');
          
          const rowData1 = [
            String(index + 1),
            item.title || 'N/A',
            item.description || 'N/A',
            item.current_performance_status || 'N/A',
            item.target_value || 'N/A',
            item.measure_unit || 'N/A',
            item.expected_completion_date ? new Date(item.expected_completion_date).toLocaleDateString() : 'N/A',
            item.goal_weight || 'N/A'
          ];
          
          rowData1.forEach((data, i) => {
            const cellText = String(data);
            doc.text(cellText, xPos, currentY + 5, { 
              width: scaledWidths1[i] - 6, 
              align: 'left',
              ellipsis: true
            });
            xPos += scaledWidths1[i];
          });
          
          currentY += rowHeight;
          
          // Check if we need a new page
          if (currentY > 650) {
            doc.addPage();
            currentY = 50;
            // Redraw header
            doc.rect(tableLeft, currentY, tableWidth1, rowHeight).fillAndStroke('#4F46E5', '#1E1B4B');
            doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold');
            xPos = tableLeft + 3;
            headers1.forEach((header, i) => {
              doc.text(header.toUpperCase(), xPos, currentY + 8, { width: scaledWidths1[i] - 6, align: 'left' });
              xPos += scaledWidths1[i];
            });
            doc.fillColor('#000000');
            currentY += rowHeight;
          }
        });
        
        doc.rect(tableLeft, currentY, tableWidth1, 0).stroke();
        doc.y = currentY + 20;
        
        // Table 2: Ratings & Comments (5 columns)
        const tableTop2 = doc.y;
        const colWidths2 = [30, 80, 150, 80, 155]; // #, EMPLOYEE SELF RATING, EMPLOYEE COMMENT, MANAGER RATING, MANAGER COMMENT
        const totalWidth2 = colWidths2.reduce((sum, w) => sum + w, 0);
        const scaleFactor2 = tableWidth / totalWidth2;
        const scaledWidths2 = colWidths2.map(w => Math.floor(w * scaleFactor2));
        const tableWidth2 = scaledWidths2.reduce((sum, w) => sum + w, 0);
        
        // Header row for Table 2
        doc.rect(tableLeft, tableTop2, tableWidth2, rowHeight).fillAndStroke('#7C3AED', '#4C1D95');
        doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold');
        
        const headers2 = ['#', 'EMPLOYEE SELF RATING', 'EMPLOYEE COMMENT', 'MANAGER RATING', 'MANAGER COMMENT'];
        xPos = tableLeft + 3;
        headers2.forEach((header, i) => {
          doc.text(header.toUpperCase(), xPos, tableTop2 + 8, { width: scaledWidths2[i] - 6, align: 'left' });
          xPos += scaledWidths2[i];
        });
        
        doc.fillColor('#000000');
        currentY = tableTop2 + rowHeight;
        
        // Data rows for Table 2
        kpiItems.forEach((item, index) => {
          const empRating = employeeItemRatings[item.id] || 0;
          const empComment = employeeItemComments[item.id] || '';
          const mgrRating = managerItemRatings[item.id] || 0;
          const mgrComment = managerItemComments[item.id] || '';
          
          if (index % 2 === 0) {
            doc.rect(tableLeft, currentY, tableWidth2, rowHeight).fillColor('#F9FAFB').fill();
          } else {
            doc.rect(tableLeft, currentY, tableWidth2, rowHeight).fillColor('#FFFFFF').fill();
          }
          doc.fillColor('#000000');
          doc.rect(tableLeft, currentY, tableWidth2, rowHeight).stroke();
          
          xPos = tableLeft + 3;
          doc.fontSize(8).font('Helvetica');
          
          const rowData2 = [
            String(index + 1),
            empRating > 0 ? empRating.toFixed(2) : 'N/A',
            empComment || 'N/A',
            mgrRating > 0 ? mgrRating.toFixed(2) : 'N/A',
            mgrComment || 'N/A'
          ];
          
          rowData2.forEach((data, i) => {
            const cellText = String(data);
            doc.text(cellText, xPos, currentY + 5, { 
              width: scaledWidths2[i] - 6, 
              align: 'left',
              ellipsis: true
            });
            xPos += scaledWidths2[i];
          });
          
          currentY += rowHeight;
          
          // Check if we need a new page
          if (currentY > 650) {
            doc.addPage();
            currentY = 50;
            // Redraw header
            doc.rect(tableLeft, currentY, tableWidth2, rowHeight).fillAndStroke('#7C3AED', '#4C1D95');
            doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold');
            xPos = tableLeft + 3;
            headers2.forEach((header, i) => {
              doc.text(header.toUpperCase(), xPos, currentY + 8, { width: scaledWidths2[i] - 6, align: 'left' });
              xPos += scaledWidths2[i];
            });
            doc.fillColor('#000000');
            currentY += rowHeight;
          }
        });
        
        doc.rect(tableLeft, currentY, tableWidth2, 0).stroke();
        doc.y = currentY + 15;
      } else {
        doc.fontSize(11).font('Helvetica').fillColor('#6B7280').text('No KPI items found.', { italic: true });
        doc.fillColor('#000000');
        doc.moveDown();
      }

      // Overall Manager Comments
      if (reviewData.overall_manager_comment) {
        doc.addPage();
        doc.fontSize(16).font('Helvetica-Bold').fillColor('#1E40AF').text('Overall Manager Comments', { underline: true });
        doc.fillColor('#000000');
        doc.moveDown(0.5);
        doc.fontSize(11).font('Helvetica').text(reviewData.overall_manager_comment, {
          width: 495,
          align: 'left'
        });
        doc.moveDown(2);
      }

      // Signatures Section
      doc.addPage();
      doc.fontSize(16).font('Helvetica-Bold').text('Signatures', { underline: true });
      doc.moveDown(2);

      // Employee Signature Box
      doc.rect(50, doc.y, 240, 120).fillAndStroke('#DBEAFE', '#1E40AF');
      doc.fillColor('#1E40AF').fontSize(12).font('Helvetica-Bold');
      doc.text('Employee Signature', 55, doc.y + 5);
      doc.fillColor('#000000');
      doc.y += 20;
      
      // Use signature from review (self-rating) or from KPI (acknowledgement) or from user profile
      const employeeSignature = reviewData.employee_signature || kpiData.employee_signature || employeeData.signature;
      if (employeeSignature) {
        try {
          const signatureBuffer = base64ToBuffer(employeeSignature);
          if (signatureBuffer) {
            doc.image(signatureBuffer, {
              fit: [220, 60],
              align: 'left',
              x: 55,
              y: doc.y
            });
            doc.y += 65;
          }
        } catch (err) {
          console.error('Error adding employee signature:', err);
          doc.fontSize(10).font('Helvetica').fillColor('#DC2626').text('Signature image unavailable', { italic: true });
          doc.fillColor('#000000');
          doc.y += 20;
        }
      } else {
        doc.fontSize(10).font('Helvetica').fillColor('#DC2626').text('No signature provided', { italic: true });
        doc.fillColor('#000000');
        doc.y += 20;
      }
      
      doc.fontSize(10).font('Helvetica');
      doc.text(`Name: ${employeeData.name || 'N/A'}`, 55, doc.y);
      doc.y += 12;
      if (reviewData.employee_signed_at || kpiData.employee_signed_at) {
        const signedDate = reviewData.employee_signed_at || kpiData.employee_signed_at;
        doc.text(`Date: ${new Date(signedDate).toLocaleDateString()}`, 55, doc.y);
        doc.y += 10;
      }

      // Manager Signature Box
      doc.rect(310, doc.y - 120, 240, 120).fillAndStroke('#F3E8FF', '#7C3AED');
      doc.fillColor('#7C3AED').fontSize(12).font('Helvetica-Bold');
      doc.text('Manager Signature', 315, doc.y - 115);
      doc.fillColor('#000000');
      const managerSignatureY = doc.y - 95;
      doc.y = managerSignatureY;
      
      // Use signature from review (manager review) or from KPI (setting) or from user profile
      const managerSignature = reviewData.manager_signature || kpiData.manager_signature || managerData.signature;
      if (managerSignature) {
        try {
          const signatureBuffer = base64ToBuffer(managerSignature);
          if (signatureBuffer) {
            doc.image(signatureBuffer, {
              fit: [220, 60],
              align: 'left',
              x: 315,
              y: doc.y
            });
            doc.y += 65;
          }
        } catch (err) {
          console.error('Error adding manager signature:', err);
          doc.fontSize(10).font('Helvetica').fillColor('#DC2626').text('Signature image unavailable', { italic: true });
          doc.fillColor('#000000');
          doc.y += 20;
        }
      } else {
        doc.fontSize(10).font('Helvetica').fillColor('#DC2626').text('No signature provided', { italic: true });
        doc.fillColor('#000000');
        doc.y += 20;
      }
      
      doc.fontSize(10).font('Helvetica');
      doc.text(`Name: ${managerData.name || 'N/A'}`, 315, doc.y);
      doc.y += 12;
      if (reviewData.manager_signed_at || kpiData.manager_signed_at) {
        const signedDate = reviewData.manager_signed_at || kpiData.manager_signed_at;
        doc.text(`Date: ${new Date(signedDate).toLocaleDateString()}`, 315, doc.y);
        doc.y += 10;
      }

      // Footer
      doc.fontSize(10).font('Helvetica').text(
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

module.exports = { generateKPIReviewPDF, generateAcknowledgedKPIPDF, generateCompletedReviewPDF };

