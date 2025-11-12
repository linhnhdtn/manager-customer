import type { Customer } from "./types";

interface MetafieldDisplayCellProps {
  customer: Customer;
  metafieldType: "cart" | "annual";
}

export function MetafieldDisplayCell({ customer, metafieldType }: MetafieldDisplayCellProps) {
  const metafieldValue = metafieldType === "cart"
    ? customer.cartLimitMetafield?.value
    : customer.annualLimitMetafield?.value;

  return (
    <span>{metafieldValue || "Not set"}</span>
  );
}
