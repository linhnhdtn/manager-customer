import { useState } from "react";
import { useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { EditCustomerModal } from "./EditCustomerModal";
import type { Customer, ActionResponse } from "./types";

interface EditableMetafieldCellProps {
  customer: Customer;
}

export function EditableMetafieldCell({ customer }: EditableMetafieldCellProps) {
  const fetcher = useFetcher<ActionResponse>({ key: `edit-customer-${customer.id}` });
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
