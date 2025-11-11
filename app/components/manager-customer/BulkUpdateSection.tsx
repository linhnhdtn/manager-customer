import { useState, useEffect } from "react";
import { useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { ConfirmModal } from "./ConfirmModal";
import type { ActionResponse } from "./types";

export function BulkUpdateSection() {
  const fetcher = useFetcher<ActionResponse>({ key: "bulk-update" });
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
