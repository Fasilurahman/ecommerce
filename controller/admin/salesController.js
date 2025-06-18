const Order = require("../../models/orderSchema");
const PDFDocument = require('pdfkit');
const getSalesReport = async (req, res) => {
  try {
      const { startDate, endDate, userFilter } = req.query;
      const matchQuery = {};

      // Check if a date range is provided for filtering
      if (startDate && endDate) {
          matchQuery.createdOn = {
              $gte: new Date(startDate),
              $lte: new Date(endDate),
          };
      } else if (userFilter) {
          const today = new Date();
          switch (userFilter) {
              case 'Today':
                  matchQuery.createdOn = {
                      $gte: new Date(today.setHours(0, 0, 0, 0)),
                      $lte: new Date(today.setHours(23, 59, 59, 999)),
                  };
                  break;
              case 'Weekly':
                  const weekStart = new Date(today);
                  weekStart.setDate(today.getDate() - today.getDay()); // Get the start of the week
                  matchQuery.createdOn = {
                      $gte: weekStart,
                      $lte: today,
                  };
                  break;
              case 'Monthly':
                  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
                  matchQuery.createdOn = {
                      $gte: monthStart,
                      $lte: today,
                  };
                  break;
              case 'Yearly':
                  const yearStart = new Date(today.getFullYear(), 0, 1);
                  matchQuery.createdOn = {
                      $gte: yearStart,
                      $lte: today,
                  };
                  break;
              default:
                  break;
          }
      }

      // Fetch orders within the given date range or user filter
      const orders = await Order.find(matchQuery).populate('userId');

      // Calculate the overall stats
      const overallSalesCount = orders.length;
      const overallAmount = orders.reduce((acc, order) => acc + order.finalPrice, 0);
      const overallDiscount = orders.reduce((acc, order) => acc + order.discount, 0);

      // Render the 'salesReport' view with the fetched data
      res.render('salesReport', {
          orders,
          overallSalesCount,
          overallAmount,
          overallDiscount,
      });
  } catch (error) {
      console.error("Error generating sales report:", error);
      res.status(500).json({ success: false, message: "Server error" });
  }
};



const generatePDF = async (req, res) => {
  try {
      const { startDate, endDate } = req.query;
      const matchQuery = {};
        console.log("Generating PDF with query:", req.query);

      if (startDate && endDate) {
          matchQuery.createdOn = {
              $gte: new Date(startDate),
              $lte: new Date(endDate),
          };
      }

      const orders = await Order.find(matchQuery).populate('userId');

      const doc = new PDFDocument();
      let fileName = `Sales_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Type', 'application/pdf');

      doc.pipe(res);

      doc.fontSize(25).text('Sales Report', { align: 'center' });
      doc.moveDown();
      
      orders.forEach(order => {
          doc
              .fontSize(12)
              .text(`Order ID: ${order.orderId}`)
              .text(`User Name: ${order.userId.name}`)
              .text(`Total Amount: ₹${order.finalPrice.toFixed(2)}`)
              .text(`Ordered At: ${order.createdOn.toLocaleDateString()}`)
              .text(`Delivered At: ${order.deliveredAt ? order.deliveredAt.toLocaleDateString() : 'Pending'}`)
              .text(`Payment Method: ${order.paymentMethod}`)
              .moveDown();
      });

      doc.end();
  } catch (error) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ success: false, message: "Error generating PDF" });
  }
};

module.exports = { getSalesReport, generatePDF };