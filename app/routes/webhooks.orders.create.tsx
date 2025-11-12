import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

interface OrderWebhookPayload {
  id: number;
  admin_graphql_api_id: string;
  created_at: string;
  updated_at: string;
  name: string;
  email?: string;
  total_price: string;
  subtotal_price: string;
  total_tax: string;
  currency: string;
  financial_status: string;
  fulfillment_status?: string;
  customer?: {
    id: number;
    email?: string;
    first_name?: string;
    last_name?: string;
    default_address?: {
      first_name?: string;
      last_name?: string;
      address1?: string;
      city?: string;
      country?: string;
    };
  };
  line_items: Array<{
    id: number;
    title: string;
    quantity: number;
    price: string;
    sku?: string;
    product_id?: number;
    variant_id?: number;
  }>;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  try {
    const orderData = payload as OrderWebhookPayload;

    console.log("=== ORDER CREATED ===");
    console.log("Order ID:", orderData.id);
    console.log("Order Name:", orderData.name);
    console.log("Order Total:", orderData.total_price, orderData.currency);
    console.log("Customer:", orderData.customer?.email || "Guest");
    console.log("Customer ID:", orderData.customer?.id);
    console.log("Line Items:", orderData.line_items.length);

    // TODO: Implement your business logic here
    // Examples:
    // 1. Update customer's annual_spent metafield
    // 2. Check if order exceeds customer's annual purchase limit
    // 3. Send notification emails
    // 4. Update inventory tracking
    // 5. Log order data to database

    // Example: Update annual_spent for customer
    if (orderData.customer?.id) {
      const customerId = `gid://shopify/Customer/${orderData.customer.id}`;
      console.log("TODO: Update annual_spent metafield for customer:", customerId);
      console.log("Order amount to add:", orderData.total_price);

      // You can use admin.graphql here to update metafields
      // const { admin } = await authenticate.admin(request); // Note: This requires session
      // For webhooks, you might need to use a different approach or store data for later processing
    }

    console.log("=== END ORDER CREATED ===");

  } catch (error) {
    console.error("Error processing orders/create webhook:", error);
    // Return 200 even on error to prevent webhook retry storms
  }

  return new Response(null, { status: 200 });
};
