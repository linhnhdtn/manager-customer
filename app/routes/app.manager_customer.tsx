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

function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  value
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  value: string;
}) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "8px",
          padding: "24px",
          maxWidth: "500px",
          width: "90%",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: "0 0 16px 0", fontSize: "20px", fontWeight: 600 }}>
          Confirm Bulk Update
        </h2>
        <p style={{ margin: "0 0 24px 0", color: "#6d7175", fontSize: "14px", lineHeight: "1.6" }}>
          Are you sure you want to update the value <strong style={{ color: "#202223" }}>{value}</strong> for <strong style={{ color: "#202223" }}>ALL</strong> customers?
          <br /><br />
          This action cannot be undone.
        </p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "10px 20px",
              border: "1px solid #c9cccf",
              borderRadius: "4px",
              backgroundColor: "transparent",
              color: "#202223",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: 500,
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f6f6f7")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            style={{
              padding: "10px 20px",
              border: "1px solid #d82c0d",
              borderRadius: "4px",
              backgroundColor: "#d82c0d",
              color: "white",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: 500,
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#bf2600")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#d82c0d")}
          >
            Confirm Update
          </button>
        </div>
      </div>
    </div>
  );
}

function EditCustomerModal({
  isOpen,
  onClose,
  customer,
  fetcher,
  shopify,
}: {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
  fetcher: any;
  shopify: any;
}) {
  const [value, setValue] = useState(customer.metafield?.value || "");
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const isLoading = fetcher.state === "submitting";

  // Reset value and submitted flag when modal opens
  useEffect(() => {
    if (isOpen) {
      setValue(customer.metafield?.value || "");
      setHasSubmitted(false);
    }
  }, [isOpen, customer.metafield?.value]);

  // Handle fetcher response
  useEffect(() => {
    // Only process if we've submitted and fetcher is no longer submitting
    if (hasSubmitted && fetcher.state === "idle" && fetcher.data && isOpen) {
      if (fetcher.data.success) {
        shopify.toast.show("Updated successfully");
        onClose();
        // Reload to show updated value
        setTimeout(() => {
          window.location.reload();
        }, 100);
      } else if (fetcher.data.error) {
        shopify.toast.show(`Error: ${fetcher.data.error}`, { isError: true });
        setHasSubmitted(false); // Reset to allow retry
      }
    }
  }, [fetcher.state, fetcher.data, hasSubmitted, isOpen, shopify, onClose]);

  const handleSave = () => {
    if (!value || value.trim() === "") {
      shopify.toast.show("Please enter a value", { isError: true });
      return;
    }

    const numValue = parseInt(value, 10);
    if (isNaN(numValue) || numValue < 0) {
      shopify.toast.show("Please enter a valid positive number", { isError: true });
      return;
    }

    // Mark that we've submitted to track the response
    setHasSubmitted(true);

    fetcher.submit(
      {
        customerId: customer.id,
        maxAmount: value,
      },
      {
        method: "POST",
        navigate: false,
      }
    );
  };

  if (!isOpen) return null;

  const customerName = customer.firstName || customer.lastName
    ? `${customer.firstName || ""} ${customer.lastName || ""}`.trim()
    : customer.email || "Customer";

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "8px",
          padding: "24px",
          maxWidth: "500px",
          width: "90%",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: "0 0 8px 0", fontSize: "20px", fontWeight: 600 }}>
          Edit Max Amount
        </h2>
        <p style={{ margin: "0 0 24px 0", color: "#6d7175", fontSize: "14px" }}>
          {customerName}
        </p>

        <div style={{ marginBottom: "24px" }}>
          <label
            htmlFor="max-amount-input"
            style={{
              display: "block",
              marginBottom: "8px",
              fontSize: "14px",
              fontWeight: 500,
              color: "#202223",
            }}
          >
            Max Amount
          </label>
          <input
            id="max-amount-input"
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isLoading) {
                e.preventDefault();
                handleSave();
              }
            }}
            disabled={isLoading}
            placeholder="Enter value"
            min="0"
            step="1"
            autoFocus
            style={{
              width: "100%",
              padding: "10px 12px",
              border: "1px solid #c9cccf",
              borderRadius: "4px",
              fontSize: "14px",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            style={{
              padding: "10px 20px",
              border: "1px solid #c9cccf",
              borderRadius: "4px",
              backgroundColor: "transparent",
              color: "#202223",
              cursor: isLoading ? "not-allowed" : "pointer",
              fontSize: "14px",
              fontWeight: 500,
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) => !isLoading && (e.currentTarget.style.backgroundColor = "#f6f6f7")}
            onMouseLeave={(e) => !isLoading && (e.currentTarget.style.backgroundColor = "transparent")}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isLoading}
            style={{
              padding: "10px 20px",
              border: "1px solid #2c6ecb",
              borderRadius: "4px",
              backgroundColor: "#2c6ecb",
              color: "white",
              cursor: isLoading ? "not-allowed" : "pointer",
              fontSize: "14px",
              fontWeight: 500,
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) => !isLoading && (e.currentTarget.style.backgroundColor = "#1f5199")}
            onMouseLeave={(e) => !isLoading && (e.currentTarget.style.backgroundColor = "#2c6ecb")}
          >
            {isLoading ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function BulkUpdateSection() {
  const fetcher = useFetcher<typeof action>({ key: "bulk-update" });
  const shopify = useAppBridge();
  const [bulkValue, setBulkValue] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const isLoading = fetcher.state === "submitting";

  // Handle fetcher response
  useEffect(() => {
    if (hasSubmitted && fetcher.state === "idle" && fetcher.data) {
      if (fetcher.data.success) {
        shopify.toast.show(fetcher.data.message || "All customers updated successfully");
        setBulkValue("");
        setHasSubmitted(false);
        // Reload the page to show updated values
        setTimeout(() => {
          window.location.reload();
        }, 100);
      } else if (fetcher.data.error) {
        shopify.toast.show(`Error: ${fetcher.data.error}`, { isError: true });
        setHasSubmitted(false);
      }
    }
  }, [fetcher.state, fetcher.data, hasSubmitted, shopify]);

  const handleBulkSave = () => {
    if (!bulkValue || bulkValue.trim() === "") {
      shopify.toast.show("Please enter a value", { isError: true });
      return;
    }

    const numValue = parseInt(bulkValue, 10);
    if (isNaN(numValue) || numValue < 0) {
      shopify.toast.show("Please enter a valid positive number", { isError: true });
      return;
    }

    // Show confirmation modal instead of native confirm
    setShowConfirmModal(true);
  };

  const handleConfirm = () => {
    setHasSubmitted(true);

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
    <>
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirm}
        value={bulkValue}
      />

      <s-box padding="base" background="subdued" borderRadius="base">
        <s-block-stack gap="base">
          <s-text variant="headingSm" as="h3">
            Bulk Update
          </s-text>
          <s-paragraph>
            Enter a value and click "Update All" to apply it to all customers.
          </s-paragraph>
          <div style={{ display: "flex", gap: "12px", alignItems: "center", maxWidth: "500px" }}>
            <input
              type="number"
              value={bulkValue}
              onChange={(e) => setBulkValue(e.target.value)}
              disabled={isLoading}
              placeholder="Enter Max Amount value"
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
              {isLoading ? "Updating..." : "Update All"}
            </button>
          </div>
        </s-block-stack>
      </s-box>
    </>
  );
}

function EditableMetafieldCell({ customer }: { customer: Customer }) {
  const fetcher = useFetcher<typeof action>({ key: `edit-customer-${customer.id}` });
  const shopify = useAppBridge();
  const [showModal, setShowModal] = useState(false);

  const handleEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowModal(true);
  };

  return (
    <>
      <EditCustomerModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        customer={customer}
        fetcher={fetcher}
        shopify={shopify}
      />

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
    </>
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
          List of all customers with their name, email, and cart limit information.
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
                  <th>Name</th>
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
            <s-paragraph>No customers found.</s-paragraph>
          </s-box>
        )}
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
