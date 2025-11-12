import type { Customer } from "./types";

interface MetafieldDisplayCellProps {
  customer: Customer;
  metafieldType: "cart" | "annual" | "annualSpent";
}

export function MetafieldDisplayCell({ customer, metafieldType }: MetafieldDisplayCellProps) {
  const metafieldValue = metafieldType === "cart"
    ? customer.cartLimitMetafield?.value
    : metafieldType === "annual"
    ? customer.annualLimitMetafield?.value
    : customer.annualSpentMetafield?.value;

  return (
    <span>{metafieldValue || "Not set"}</span>
  );
}
