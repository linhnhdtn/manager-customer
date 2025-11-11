import type { LoaderFunctionArgs, HeadersFunction, ActionFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { BulkUpdateSection, EditableMetafieldCell } from "../components/manager-customer";
import type { Customer, LoaderData } from "../components/manager-customer";

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
                {customers.map((customer: Customer) => (
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
