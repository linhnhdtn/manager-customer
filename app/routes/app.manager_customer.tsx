import type { LoaderFunctionArgs, HeadersFunction, ActionFunctionArgs } from "react-router";
import { useLoaderData, useFetcher } from "react-router";
import { useState, useEffect, useRef } from "react";
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
    await admin.graphql(
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

  const isBulkUpdate = formData.get("bulkUpdate") === "true";
  const maxAmount = formData.get("maxAmount") as string;

  try {
    if (isBulkUpdate) {
      // Get all customers for bulk update
      const customersResponse = await admin.graphql(
        `#graphql
        query GetAllCustomers {
          customers(first: 250) {
            edges {
              node {
                id
              }
            }
          }
        }`,
      );

      const customersJson = await customersResponse.json();
      const customers = customersJson.data.customers.edges.map((edge: any) => edge.node);

      // Create metafields array for all customers
      const metafields = customers.map((customer: any) => ({
        ownerId: customer.id,
        namespace: "cart_limits",
        key: "max_amount",
        value: maxAmount,
        type: "number_integer",
      }));

      // Update all customers in batches (GraphQL accepts max 25 metafields per request)
      const batchSize = 25;
      const batches = [];

      for (let i = 0; i < metafields.length; i += batchSize) {
        batches.push(metafields.slice(i, i + batchSize));
      }

      let totalUpdated = 0;
      let errors = [];

      for (const batch of batches) {
        const response = await admin.graphql(
          `#graphql
          mutation UpdateCustomerMetafield($metafields: [MetafieldsSetInput!]!) {
            metafieldsSet(metafields: $metafields) {
              metafields {
                id
              }
              userErrors {
                field
                message
              }
            }
          }`,
          {
            variables: {
              metafields: batch,
            },
          },
        );

        const responseJson = await response.json();

        if (responseJson.errors) {
          errors.push(...responseJson.errors);
        }

        if (responseJson.data?.metafieldsSet?.userErrors?.length > 0) {
          errors.push(...responseJson.data.metafieldsSet.userErrors);
        } else if (responseJson.data?.metafieldsSet?.metafields) {
          totalUpdated += responseJson.data.metafieldsSet.metafields.length;
        }
      }

      if (errors.length > 0) {
        return {
          success: false,
          error: `Updated ${totalUpdated} customers, but encountered errors: ${errors[0]?.message || "Unknown error"}`,
        };
      }

      return {
        success: true,
        message: `Successfully updated ${totalUpdated} customers`,
        totalUpdated,
      };
    } else {
      // Single customer update
      const customerId = formData.get("customerId") as string;

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

      // Check for GraphQL errors
      if (responseJson.errors) {
        return {
          success: false,
          error: responseJson.errors[0]?.message || "Unknown error occurred",
        };
      }

      if (responseJson.data.metafieldsSet.userErrors.length > 0) {
        return {
          success: false,
          error: responseJson.data.metafieldsSet.userErrors[0]?.message || "Unknown error",
        };
      }

      return {
        success: true,
        metafield: responseJson.data.metafieldsSet.metafields[0],
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
};

function BulkUpdateSection() {
  const fetcher = useFetcher<typeof action>({ key: "bulk-update" });
  const shopify = useAppBridge();
  const [bulkValue, setBulkValue] = useState("");
  const isSubmittingRef = useRef(false);

  const isLoading = fetcher.state === "submitting";

  // Handle fetcher state changes
  useEffect(() => {
    if (fetcher.state === "submitting") {
      isSubmittingRef.current = true;
    }

    if (isSubmittingRef.current && fetcher.state === "idle") {
      if (fetcher.data?.success) {
        shopify.toast.show(fetcher.data.message || "All customers updated successfully");
        setBulkValue("");
        isSubmittingRef.current = false;
        // Reload the page to show updated values
        window.location.reload();
      } else if (fetcher.data?.error) {
        shopify.toast.show(`Error: ${fetcher.data.error}`, { isError: true });
        isSubmittingRef.current = false;
      }
    }
  }, [fetcher.state, fetcher.data, shopify]);

  const handleBulkSave = () => {
    if (!bulkValue || bulkValue.trim() === "") {
      shopify.toast.show("Vui lòng nhập giá trị", { isError: true });
      return;
    }

    const numValue = parseInt(bulkValue, 10);
    if (isNaN(numValue) || numValue < 0) {
      shopify.toast.show("Vui lòng nhập số dương hợp lệ", { isError: true });
      return;
    }

    if (!confirm(`Bạn có chắc muốn cập nhật giá trị ${bulkValue} cho TẤT CẢ khách hàng?`)) {
      return;
    }

    isSubmittingRef.current = true;

    fetcher.submit(
      {
        bulkUpdate: "true",
        maxAmount: bulkValue,
      },
      {
        method: "POST",
        navigate: false,
      }
    );
  };

  return (
    <s-box padding="base" background="subdued" borderRadius="base">
      <s-block-stack gap="base">
        <s-text variant="headingSm" as="h3">
          Cập nhật hàng loạt (Bulk Update)
        </s-text>
        <s-paragraph>
          Nhập giá trị và nhấn "Cập nhật tất cả" để áp dụng cho toàn bộ khách hàng.
        </s-paragraph>
        <div style={{ display: "flex", gap: "12px", alignItems: "center", maxWidth: "500px" }}>
          <input
            type="number"
            value={bulkValue}
            onChange={(e) => setBulkValue(e.target.value)}
            disabled={isLoading}
            placeholder="Nhập giá trị Max Amount"
            min="0"
            step="1"
            style={{
              padding: "8px 12px",
              border: "1px solid #c9cccf",
              borderRadius: "4px",
              flex: 1,
              fontSize: "14px",
            }}
          />
          <button
            type="button"
            onClick={handleBulkSave}
            disabled={isLoading}
            style={{
              padding: "8px 16px",
              border: "1px solid #2c6ecb",
              borderRadius: "4px",
              backgroundColor: "#2c6ecb",
              color: "white",
              cursor: isLoading ? "not-allowed" : "pointer",
              fontSize: "14px",
              fontWeight: 600,
              whiteSpace: "nowrap",
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) => !isLoading && (e.currentTarget.style.backgroundColor = "#1f5199")}
            onMouseLeave={(e) => !isLoading && (e.currentTarget.style.backgroundColor = "#2c6ecb")}
          >
            {isLoading ? "Đang cập nhật..." : "Cập nhật tất cả"}
          </button>
        </div>
      </s-block-stack>
    </s-box>
  );
}

function EditableMetafieldCell({ customer }: { customer: Customer }) {
  const fetcher = useFetcher<typeof action>({ key: `edit-customer-${customer.id}` });
  const shopify = useAppBridge();
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(customer.metafield?.value || "");
  const prevStateRef = useRef(fetcher.state);
  const isSubmittingRef = useRef(false);

  const isLoading = fetcher.state === "submitting";

  // Handle fetcher state changes
  useEffect(() => {
    // Track when we start submitting
    if (fetcher.state === "submitting") {
      isSubmittingRef.current = true;
    }

    // Detect transition from submitting to idle
    if (isSubmittingRef.current && fetcher.state === "idle" && isEditing) {
      if (fetcher.data?.success) {
        shopify.toast.show("Metafield updated successfully");
        setIsEditing(false);
        isSubmittingRef.current = false;
      } else if (fetcher.data?.error) {
        shopify.toast.show(`Error: ${fetcher.data.error}`, { isError: true });
        isSubmittingRef.current = false;
      }
    }

    prevStateRef.current = fetcher.state;
  }, [fetcher.state, fetcher.data, isEditing, shopify, customer.id]);

  const handleSave = async () => {
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

    // Mark that we're starting to submit
    isSubmittingRef.current = true;

    fetcher.submit(
      {
        customerId: customer.id,
        maxAmount: value,
      },
      {
        method: "POST",
        // Prevent navigation
        navigate: false,
      }
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
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSave();
            }
          }}
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
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleSave();
          }}
          disabled={isLoading}
          className="save-button"
          style={{
            padding: "6px 12px",
            border: "1px solid #2c6ecb",
            borderRadius: "4px",
            backgroundColor: "#2c6ecb",
            color: "white",
            cursor: isLoading ? "not-allowed" : "pointer",
            fontSize: "13px",
            fontWeight: 500,
            transition: "background-color 0.2s",
          }}
          onMouseEnter={(e) => !isLoading && (e.currentTarget.style.backgroundColor = "#1f5199")}
          onMouseLeave={(e) => !isLoading && (e.currentTarget.style.backgroundColor = "#2c6ecb")}
        >
          {isLoading ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleCancel();
          }}
          disabled={isLoading}
          className="cancel-button"
          style={{
            padding: "6px 12px",
            border: "1px solid #c9cccf",
            borderRadius: "4px",
            backgroundColor: "transparent",
            color: "#202223",
            cursor: isLoading ? "not-allowed" : "pointer",
            fontSize: "13px",
            fontWeight: 500,
            transition: "background-color 0.2s",
          }}
          onMouseEnter={(e) => !isLoading && (e.currentTarget.style.backgroundColor = "#f6f6f7")}
          onMouseLeave={(e) => !isLoading && (e.currentTarget.style.backgroundColor = "transparent")}
        >
          Cancel
        </button>
      </div>
    );
  }

  const handleEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Reset value to current metafield value when opening edit mode
    setValue(customer.metafield?.value || "");
    setIsEditing(true);
  };

  return (
    <div style={{ display: "flex", gap: "8px", alignItems: "center", justifyContent: "space-between" }}>
      <span>{customer.metafield?.value || "Not set"}</span>
      <button
        type="button"
        onClick={handleEdit}
        className="edit-button"
        style={{
          padding: "6px 12px",
          border: "1px solid #c9cccf",
          borderRadius: "4px",
          backgroundColor: "transparent",
          color: "#2c6ecb",
          cursor: "pointer",
          fontSize: "13px",
          fontWeight: 500,
          transition: "background-color 0.2s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f6f6f7")}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
      >
        Edit
      </button>
    </div>
  );
}

export default function ManagerCustomer() {
  const { customers } = useLoaderData<LoaderData>();

  return (
    <s-page heading="Customer Manager">
      <s-section heading="Bulk Update">
        <BulkUpdateSection />
      </s-section>

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
