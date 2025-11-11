import { useState, useEffect } from "react";
import { useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { ConfirmModal } from "./ConfirmModal";
import type { ActionResponse } from "./types";

export function BulkUpdateSection() {
  const cartFetcher = useFetcher<ActionResponse>({ key: "bulk-update-cart" });
  const annualFetcher = useFetcher<ActionResponse>({ key: "bulk-update-annual" });
  const shopify = useAppBridge();

  const [cartBulkValue, setCartBulkValue] = useState("");
  const [annualBulkValue, setAnnualBulkValue] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmType, setConfirmType] = useState<"cart" | "annual">("cart");
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const isCartLoading = cartFetcher.state === "submitting";
  const isAnnualLoading = annualFetcher.state === "submitting";

  // Handle cart fetcher response
  useEffect(() => {
    if (hasSubmitted && confirmType === "cart" && cartFetcher.state === "idle" && cartFetcher.data) {
      if (cartFetcher.data.success) {
        shopify.toast.show(cartFetcher.data.message || "Cart limits updated successfully for all customers");
        setCartBulkValue("");
        setHasSubmitted(false);
        setTimeout(() => {
          window.location.reload();
        }, 100);
      } else if (cartFetcher.data.error) {
        shopify.toast.show(`Error: ${cartFetcher.data.error}`, { isError: true });
        setHasSubmitted(false);
      }
    }
  }, [cartFetcher.state, cartFetcher.data, hasSubmitted, confirmType, shopify]);

  // Handle annual fetcher response
  useEffect(() => {
    if (hasSubmitted && confirmType === "annual" && annualFetcher.state === "idle" && annualFetcher.data) {
      if (annualFetcher.data.success) {
        shopify.toast.show(annualFetcher.data.message || "Annual limits updated successfully for all customers");
        setAnnualBulkValue("");
        setHasSubmitted(false);
        setTimeout(() => {
          window.location.reload();
        }, 100);
      } else if (annualFetcher.data.error) {
        shopify.toast.show(`Error: ${annualFetcher.data.error}`, { isError: true });
        setHasSubmitted(false);
      }
    }
  }, [annualFetcher.state, annualFetcher.data, hasSubmitted, confirmType, shopify]);

  const handleCartBulkSave = () => {
    if (!cartBulkValue || cartBulkValue.trim() === "") {
      shopify.toast.show("Please enter a cart limit value", { isError: true });
      return;
    }

    const numValue = parseInt(cartBulkValue, 10);
    if (isNaN(numValue) || numValue < 0) {
      shopify.toast.show("Please enter a valid positive number", { isError: true });
      return;
    }

    setConfirmType("cart");
    setShowConfirmModal(true);
  };

  const handleAnnualBulkSave = () => {
    if (!annualBulkValue || annualBulkValue.trim() === "") {
      shopify.toast.show("Please enter an annual limit value", { isError: true });
      return;
    }

    const numValue = parseInt(annualBulkValue, 10);
    if (isNaN(numValue) || numValue < 0) {
      shopify.toast.show("Please enter a valid positive number", { isError: true });
      return;
    }

    setConfirmType("annual");
    setShowConfirmModal(true);
  };

  const handleConfirm = () => {
    setHasSubmitted(true);

    if (confirmType === "cart") {
      cartFetcher.submit(
        {
          bulkUpdate: "true",
          bulkUpdateType: "cart",
          maxAmount: cartBulkValue,
        },
        {
          method: "POST",
          navigate: false,
        }
      );
    } else {
      annualFetcher.submit(
        {
          bulkUpdate: "true",
          bulkUpdateType: "annual",
          maxAmount: annualBulkValue,
        },
        {
          method: "POST",
          navigate: false,
        }
      );
    }
  };

  return (
    <>
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirm}
        value={confirmType === "cart" ? cartBulkValue : annualBulkValue}
        type={confirmType}
      />

      <s-box padding="base" background="subdued" borderRadius="base">
        <s-block-stack gap="large">
          <s-text variant="headingSm" as="h3">
            Bulk Update All Customers
          </s-text>
          <s-paragraph>
            Update all customers at once. You can update cart limits, annual limits, or both.
          </s-paragraph>

          {/* Cart Limit Bulk Update */}
          <div>
            <div style={{ marginBottom: "8px" }}>
              <s-text variant="bodyMd" as="p" fontWeight="semibold">
                Cart Limit
              </s-text>
            </div>
            <div style={{ display: "flex", gap: "12px", alignItems: "center", maxWidth: "500px" }}>
              <input
                type="number"
                value={cartBulkValue}
                onChange={(e) => setCartBulkValue(e.target.value)}
                disabled={isCartLoading}
                placeholder="Enter cart limit for all customers"
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
                onClick={handleCartBulkSave}
                disabled={isCartLoading}
                style={{
                  padding: "8px 16px",
                  border: "1px solid #2c6ecb",
                  borderRadius: "4px",
                  backgroundColor: "#2c6ecb",
                  color: "white",
                  cursor: isCartLoading ? "not-allowed" : "pointer",
                  fontSize: "14px",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  transition: "background-color 0.2s",
                }}
                onMouseEnter={(e) => !isCartLoading && (e.currentTarget.style.backgroundColor = "#1f5199")}
                onMouseLeave={(e) => !isCartLoading && (e.currentTarget.style.backgroundColor = "#2c6ecb")}
              >
                {isCartLoading ? "Updating..." : "Update All Cart Limits"}
              </button>
            </div>
          </div>

          {/* Annual Limit Bulk Update */}
          <div>
            <div style={{ marginBottom: "8px" }}>
              <s-text variant="bodyMd" as="p" fontWeight="semibold">
                Annual Purchase Limit
              </s-text>
            </div>
            <div style={{ display: "flex", gap: "12px", alignItems: "center", maxWidth: "500px" }}>
              <input
                type="number"
                value={annualBulkValue}
                onChange={(e) => setAnnualBulkValue(e.target.value)}
                disabled={isAnnualLoading}
                placeholder="Enter annual limit for all customers"
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
                onClick={handleAnnualBulkSave}
                disabled={isAnnualLoading}
                style={{
                  padding: "8px 16px",
                  border: "1px solid #2c6ecb",
                  borderRadius: "4px",
                  backgroundColor: "#2c6ecb",
                  color: "white",
                  cursor: isAnnualLoading ? "not-allowed" : "pointer",
                  fontSize: "14px",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  transition: "background-color 0.2s",
                }}
                onMouseEnter={(e) => !isAnnualLoading && (e.currentTarget.style.backgroundColor = "#1f5199")}
                onMouseLeave={(e) => !isAnnualLoading && (e.currentTarget.style.backgroundColor = "#2c6ecb")}
              >
                {isAnnualLoading ? "Updating..." : "Update All Annual Limits"}
              </button>
            </div>
          </div>
        </s-block-stack>
      </s-box>
    </>
  );
}
