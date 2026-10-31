package com.cakeplatform.api.modules.order;

import com.lowagie.text.*;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;

@Service
public class InvoiceService {

    public byte[] generateInvoice(Order order) throws DocumentException, IOException {
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        Document document = new Document(PageSize.A4);
        PdfWriter.getInstance(document, outputStream);

        document.open();

        Font titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 18);
        Font boldFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12);
        Font normalFont = FontFactory.getFont(FontFactory.HELVETICA, 12);

        // Header
        Paragraph title = new Paragraph("INVOICE", titleFont);
        title.setAlignment(Element.ALIGN_CENTER);
        document.add(title);
        document.add(new Paragraph(" ")); // Blank line

        // Shop Details
        document.add(new Paragraph(order.getShop().getBusinessName(), boldFont));
        boolean hideStreet = (order.getShop().getStorefrontSettings() != null)
                ? Boolean.TRUE.equals(order.getShop().getStorefrontSettings().getHideStreetAddress())
                : (order.getShop().getBusinessType() == com.cakeplatform.api.modules.shop.BusinessType.HOME_BAKERY);
        if (hideStreet) {
            java.util.List<String> localityParts = java.util.stream.Stream.of(
                    order.getShop().getArea(),
                    order.getShop().getCity(),
                    order.getShop().getState()
            ).filter(s -> s != null && !s.trim().isEmpty()).toList();
            String localityAddress = localityParts.isEmpty() ? "Verified Bakery Location"
                    : String.join(", ", localityParts) + (order.getShop().getPincode() != null ? " - " + order.getShop().getPincode() : "");
            document.add(new Paragraph(localityAddress, normalFont));
        } else if (order.getShop().getAddress() != null) {
            document.add(new Paragraph(order.getShop().getAddress(), normalFont));
        }
        document.add(new Paragraph("Phone: " + order.getShop().getPhone(), normalFont));

        document.add(new Paragraph(" ")); // Blank line

        // Order Details
        document.add(new Paragraph("Order No: " + order.getOrderNumber(), normalFont));
        document.add(new Paragraph("Date: " + order.getCreatedAt().toLocalDate().toString(), normalFont));
        document.add(new Paragraph("Customer: " + order.getCustomerName(), normalFont));
        document.add(new Paragraph("Email: " + order.getCustomerEmail(), normalFont));
        document.add(new Paragraph(" "));

        // Items Table
        PdfPTable table = new PdfPTable(4);
        table.setWidthPercentage(100);
        table.setWidths(new float[]{4f, 2f, 2f, 2f});

        addTableHeader(table, boldFont);
        
        for (OrderItem item : order.getItems()) {
            addTableRow(table, item, normalFont);
        }
        document.add(table);
        
        document.add(new Paragraph(" "));
        
        // Summary
        Paragraph subtotal = new Paragraph("Subtotal: ₹" + order.getSubtotal(), normalFont);
        subtotal.setAlignment(Element.ALIGN_RIGHT);
        document.add(subtotal);
        
        if (order.getDiscountAmount() != null && order.getDiscountAmount().doubleValue() > 0) {
            Paragraph discount = new Paragraph("Discount (" + order.getCouponCode() + "): -₹" + order.getDiscountAmount(), normalFont);
            discount.setAlignment(Element.ALIGN_RIGHT);
            document.add(discount);
        }
        
        Paragraph delivery = new Paragraph("Delivery Charge: ₹" + order.getDeliveryCharge(), normalFont);
        delivery.setAlignment(Element.ALIGN_RIGHT);
        document.add(delivery);
        
        Paragraph total = new Paragraph("Total Amount: ₹" + order.getTotalAmount(), boldFont);
        total.setAlignment(Element.ALIGN_RIGHT);
        document.add(total);

        String payMethod = "COD".equalsIgnoreCase(order.getPaymentMethod()) ? "Cash on Delivery (COD)" : "Online / Prepaid";
        String payStatus = "PAID".equalsIgnoreCase(order.getPaymentStatus()) ? "PAID" : "PAYMENT DUE (Collect on Delivery)";
        Paragraph paymentInfo = new Paragraph("Payment Mode: " + payMethod + " | Status: " + payStatus, boldFont);
        paymentInfo.setAlignment(Element.ALIGN_RIGHT);
        document.add(paymentInfo);

        document.close();

        return outputStream.toByteArray();
    }

    private void addTableHeader(PdfPTable table, Font font) {
        String[] headers = {"Item", "Unit Price", "Qty", "Total"};
        for (String header : headers) {
            PdfPCell cell = new PdfPCell(new Phrase(header, font));
            cell.setHorizontalAlignment(Element.ALIGN_CENTER);
            cell.setPadding(5);
            table.addCell(cell);
        }
    }

    private void addTableRow(PdfPTable table, OrderItem item, Font font) {
        String itemName = item.getProductNameSnapshot();
        if (item.getVariantName() != null) {
            itemName += " (" + item.getVariantName() + ")";
        }
        if (item.getDietaryPreference() != null) {
            itemName += "\n[" + item.getDietaryPreference() + "]";
        }
        if (item.getAddonsSummary() != null && !item.getAddonsSummary().isBlank()) {
            itemName += "\n+ " + item.getAddonsSummary();
        }
        
        table.addCell(new Phrase(itemName, font));
        table.addCell(new Phrase("₹" + item.getUnitPrice().toString(), font));
        table.addCell(new Phrase(String.valueOf(item.getQuantity()), font));
        table.addCell(new Phrase("₹" + item.getTotalPrice().toString(), font));
    }

    public byte[] generateSubscriptionInvoice(com.cakeplatform.api.modules.payment.Payment payment) throws DocumentException, IOException {
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        Document document = new Document(PageSize.A4);
        PdfWriter.getInstance(document, outputStream);

        document.open();

        Font titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 18);
        Font boldFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12);
        Font normalFont = FontFactory.getFont(FontFactory.HELVETICA, 11);

        // Header
        Paragraph title = new Paragraph("TAX INVOICE - PLATFORM SUBSCRIPTION", titleFont);
        title.setAlignment(Element.ALIGN_CENTER);
        document.add(title);
        document.add(new Paragraph(" "));

        // Issuer Details
        document.add(new Paragraph("CakeStore Platform Network", boldFont));
        document.add(new Paragraph("Cloud Bakery Technologies Pvt. Ltd.", normalFont));
        document.add(new Paragraph("Email: billing@cakestore.in | Phone: +91 98231 00000", normalFont));
        document.add(new Paragraph(" "));

        // Invoice & Shop Details
        document.add(new Paragraph("Invoice No: INV-SUB-" + payment.getId(), boldFont));
        document.add(new Paragraph("Date: " + (payment.getPaidAt() != null ? payment.getPaidAt().toLocalDate().toString() : payment.getCreatedAt().toLocalDate().toString()), normalFont));
        document.add(new Paragraph("Billed To: " + (payment.getShop() != null ? payment.getShop().getBusinessName() : "Bakery Owner"), boldFont));
        if (payment.getShop() != null && payment.getShop().getAddress() != null) {
            document.add(new Paragraph("Address: " + payment.getShop().getAddress(), normalFont));
        }
        document.add(new Paragraph(" "));

        // Itemized Table
        PdfPTable table = new PdfPTable(3);
        table.setWidthPercentage(100);
        table.setWidths(new float[]{5f, 3f, 2f});

        PdfPCell c1 = new PdfPCell(new Phrase("Service Description", boldFont));
        PdfPCell c2 = new PdfPCell(new Phrase("Transaction Reference", boldFont));
        PdfPCell c3 = new PdfPCell(new Phrase("Amount", boldFont));
        c1.setPadding(6); c2.setPadding(6); c3.setPadding(6);
        table.addCell(c1); table.addCell(c2); table.addCell(c3);

        String desc = "CakeStore Pro Bakery SaaS Subscription";
        if (payment.getSubscription() != null && payment.getSubscription().getPlan() != null) {
            desc = payment.getSubscription().getPlan().getName();
        }

        String ref = payment.getProviderPaymentId() != null ? payment.getProviderPaymentId() : "N/A";
        String amt = "₹" + payment.getAmount().toString();

        table.addCell(new Phrase(desc, normalFont));
        table.addCell(new Phrase(ref, normalFont));
        table.addCell(new Phrase(amt, normalFont));

        document.add(table);
        document.add(new Paragraph(" "));

        Paragraph total = new Paragraph("Total Paid: " + amt + " (" + payment.getCurrency() + ")", boldFont);
        total.setAlignment(Element.ALIGN_RIGHT);
        document.add(total);

        Paragraph status = new Paragraph("Payment Status: " + payment.getStatus(), normalFont);
        status.setAlignment(Element.ALIGN_RIGHT);
        document.add(status);

        document.close();
        return outputStream.toByteArray();
    }
}
