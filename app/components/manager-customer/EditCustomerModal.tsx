import { useState, useEffect, useRef } from "react";
import type { FetcherWithComponents } from "react-router";
import type { Customer } from "./types";

interface EditCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
  fetcher: FetcherWithComponents<any>;
  shopify: any;
}

export function EditCustomerModal({
  isOpen,
  onClose,
  customer,
  fetcher,
  shopify,
}: EditCustomerModalProps) {
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
