import type { LoaderFunctionArgs, HeadersFunction, ActionFunctionArgs } from "react-router";
import { useLoaderData, useFetcher } from "react-router";
import { useState, useEffect } from "react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useAppBridge } from "@shopify/app-bridge-react";

interface Customer {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  metafield: {
    value: string;
  } | null;
}

interface LoaderData {
  customers: Customer[];
}

// Helper function to ensure metafield definition exists
async function ensureMetafieldDefinition(admin: any) {
  const checkResponse = await admin.graphql(
    `#graphql
    query CheckMetafieldDefinition {
      metafieldDefinitions(first: 10, ownerType: CUSTOMER) {
        edges {
          node {
            id
            namespace
            key
            name
          }
        }
      }
    }`
  );

  const checkJson = await checkResponse.json();
  const definitions = checkJson.data?.metafieldDefinitions?.edges || [];

  const exists = definitions.some((edge: any) =>
    edge.node.namespace === "cart_limits" && edge.node.key === "max_amount"
  );

  if (!exists) {
    console.log("Creating metafield definition for cart_limits.max_amount");
    const createResponse = await admin.graphql(
      `#graphql
      mutation CreateMetafieldDefinition($definition: MetafieldDefinitionInput!) {
        metafieldDefinitionCreate(definition: $definition) {
          createdDefinition {
            id
            namespace
            key
          }
          userErrors {
            field
            message
          }
        }
      }`,
      {
        variables: {
          definition: {
            name: "Cart Max Amount",
            namespace: "cart_limits",
            key: "max_amount",
            description: "Maximum amount allowed in cart for this customer",
            type: "number_integer",
            ownerType: "CUSTOMER",
          }
        }
      }
    );

    const createJson = await createResponse.json();
    console.log("Metafield definition creation result:", createJson);
  }
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  // Ensure metafield definition exists
  await ensureMetafieldDefinition(admin);

  const response = await admin.graphql(
    `#graphql
    query GetCustomers {
      customers(first: 50) {
        edges {
          node {
            id
            firstName
            lastName
            email
            metafield(namespace: "cart_limits", key: "max_amount") {
              value
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }`,
  );

  const responseJson = await response.json();
  const customers = responseJson.data.customers.edges.map((edge: any) => edge.node);

  return { customers };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const customerId = formData.get("customerId") as string;
  const maxAmount = formData.get("maxAmount") as string;

  console.log("Updating metafield for customer:", customerId, "with value:", maxAmount);

  try {
    const response = await admin.graphql(
      `#graphql
      mutation UpdateCustomerMetafield($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            id
            namespace
            key
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
              namespace: "cart_limits",
              key: "max_amount",
              value: maxAmount,
              type: "number_integer",
            },
          ],
        },
      },
    );

    const responseJson = await response.json();
    console.log("GraphQL Response:", JSON.stringify(responseJson, null, 2));

    // Check for GraphQL errors
    if (responseJson.errors) {
      console.error("GraphQL Errors:", responseJson.errors);
      return {
        success: false,
        error: responseJson.errors[0]?.message || "Unknown error occurred",
      };
    }

    if (responseJson.data.metafieldsSet.userErrors.length > 0) {
      console.error("User Errors:", responseJson.data.metafieldsSet.userErrors);
      return {
        success: false,
        error: responseJson.data.metafieldsSet.userErrors[0]?.message || "Unknown error",
      };
    }

    return {
      success: true,
      metafield: responseJson.data.metafieldsSet.metafields[0],
    };
  } catch (error) {
    console.error("Action error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
};

function EditableMetafieldCell({ customer }: { customer: Customer }) {
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(customer.metafield?.value || "");

  const isLoading = fetcher.state === "submitting";

  // Show success toast when update completes
  useEffect(() => {
    if (fetcher.state === "idle" && isEditing) {
      if (fetcher.data?.success) {
        shopify.toast.show("Metafield updated successfully");
        setIsEditing(false);
      } else if (fetcher.data?.error) {
        shopify.toast.show(`Error: ${fetcher.data.error}`, { isError: true });
      }
    }
  }, [fetcher.data?.success, fetcher.data?.error, fetcher.state, isEditing, shopify]);

  const handleSave = () => {
    // Validate that value is a valid number
    if (!value || value.trim() === "") {
      shopify.toast.show("Please enter a valid amount", { isError: true });
      return;
    }

    const numValue = parseInt(value, 10);
    if (isNaN(numValue) || numValue < 0) {
      shopify.toast.show("Please enter a valid positive number", { isError: true });
      return;
    }

    fetcher.submit(
      {
        customerId: customer.id,
        maxAmount: value,
      },
      { method: "POST" }
    );
  };

  const handleCancel = () => {
    setValue(customer.metafield?.value || "");
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <input
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={isLoading}
          placeholder="Enter amount"
          min="0"
          step="1"
          style={{
            padding: "6px 12px",
            border: "1px solid #c9cccf",
            borderRadius: "4px",
            flex: 1,
          }}
        />
        <s-button
          size="slim"
          onClick={handleSave}
          {...(isLoading ? { loading: true } : {})}
        >
          Save
        </s-button>
        <s-button size="slim" variant="tertiary" onClick={handleCancel} disabled={isLoading}>
          Cancel
        </s-button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: "8px", alignItems: "center", justifyContent: "space-between" }}>
      <span>{customer.metafield?.value || "Not set"}</span>
      <s-button size="slim" variant="tertiary" onClick={() => setIsEditing(true)}>
        Edit
      </s-button>
    </div>
  );
}

export default function ManagerCustomer() {
  const { customers } = useLoaderData<LoaderData>();

  return (
    <s-page heading="Customer Manager">
      <s-section heading="All Customers">
        <s-paragraph>
          Danh sách tất cả khách hàng với thông tin tên, email và giới hạn giỏ hàng.
        </s-paragraph>

        <style>{`
          .customer-table {
            width: 100%;
            border-collapse: collapse;
          }
          .customer-table th {
            background-color: #f6f6f7;
            padding: 12px 16px;
            text-align: left;
            font-weight: 600;
            border: 1px solid #e1e3e5;
            border-bottom: 2px solid #c9cccf;
          }
          .customer-table td {
            padding: 12px 16px;
            border: 1px solid #e1e3e5;
          }
          .customer-table tbody tr:hover {
            background-color: #f9fafb;
          }
          .customer-table tbody tr:nth-child(even) {
            background-color: #fafbfb;
          }
        `}</style>

        <s-box padding="none" borderWidth="base" borderRadius="base">
          <s-data-table>
            <table className="customer-table">
              <thead>
                <tr>
                  <th>Tên</th>
                  <th>Email</th>
                  <th>Max Amount (Cart Limit)</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      {customer.firstName || customer.lastName
                        ? `${customer.firstName || ""} ${customer.lastName || ""}`.trim()
                        : "N/A"}
                    </td>
                    <td>{customer.email || "N/A"}</td>
                    <td>
                      <EditableMetafieldCell customer={customer} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </s-data-table>
        </s-box>

        {customers.length === 0 && (
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-paragraph>Không có khách hàng nào.</s-paragraph>
          </s-box>
        )}
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
