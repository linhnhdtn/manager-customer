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

interface CustomerMetafieldQueryResponse {
  data?: {
    customer?: {
      id: string;
      metafield?: {
        value: string;
      } | null;
    } | null;
  };
}

interface MetafieldsSetResponse {
  data?: {
    metafieldsSet?: {
      metafields?: Array<{
        id: string;
        value: string;
      }>;
      userErrors?: Array<{
        field: string[];
        message: string;
      }>;
    };
  };
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload, admin } = await authenticate.webhook(request);

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

    // Update annual_spent for customer
    if (orderData.customer?.id && admin) {
      const customerId = `gid://shopify/Customer/${orderData.customer.id}`;
      const orderTotal = parseFloat(orderData.total_price);

      console.log("Updating annual_spent for customer:", customerId);
      console.log("Order amount to add:", orderTotal);

      // 1. Fetch current annual_spent value
      const customerResponse = await admin.graphql<CustomerMetafieldQueryResponse>(
        `#graphql
        query GetCustomerAnnualSpent($customerId: ID!) {
          customer(id: $customerId) {
            id
            metafield(namespace: "annual_spent", key: "amount") {
              value
            }
          }
        }`,
        {
          variables: {
            customerId: customerId,
          },
        }
      );

      const customerJson = await customerResponse.json();
      const currentAnnualSpent = parseFloat(
        customerJson.data?.customer?.metafield?.value || "0"
      );

      console.log("Current annual_spent:", currentAnnualSpent);

      // 2. Calculate new total
      const newAnnualSpent = currentAnnualSpent + orderTotal;

      console.log("New annual_spent:", newAnnualSpent);

      // 3. Update metafield with new total
      const updateResponse = await admin.graphql<MetafieldsSetResponse>(
        `#graphql
        mutation UpdateAnnualSpent($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            metafields {
              id
              value
            }
            userErrors {
              field
              message
            }
          }
        }`,
        {
          variables: {
            metafields: [
              {
                ownerId: customerId,
                namespace: "annual_spent",
                key: "amount",
                value: newAnnualSpent.toString(),
                type: "number_decimal",
              },
            ],
          },
        }
      );

      const updateJson = await updateResponse.json();

      if (updateJson.data?.metafieldsSet?.userErrors?.length) {
        console.error(
          "Error updating annual_spent:",
          updateJson.data.metafieldsSet.userErrors
        );
      } else {
        console.log("Successfully updated annual_spent to:", newAnnualSpent);
      }
    } else if (!orderData.customer?.id) {
      console.log("Skipping annual_spent update: Guest checkout");
    }

    console.log("=== END ORDER CREATED ===");

  } catch (error) {
    console.error("Error processing orders/create webhook:", error);
    // Return 200 even on error to prevent webhook retry storms
  }

  return new Response(null, { status: 200 });
};
