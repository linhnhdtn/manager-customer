import type {
  CartValidationsGenerateRunInput,
  CartValidationsGenerateRunResult,
  ValidationError
} from "../generated/api";

export function cartValidationsGenerateRun(input: CartValidationsGenerateRunInput): CartValidationsGenerateRunResult {
  // Log full input for debugging
  console.error("=== CART VALIDATION INPUT ===");
  console.error("Full input:", JSON.stringify(input, null, 2));

  const errors: ValidationError[] = [];

  // Get cart total amount
  const cartTotal = parseFloat(input.cart.cost.subtotalAmount.amount);
  console.error("Cart total:", cartTotal);

  // Get customer from buyerIdentity
  const customer = input.cart.buyerIdentity?.customer;
  console.error("Customer:", customer ? "Logged in" : "Not logged in");

  // If no customer (guest checkout), skip validation
  if (!customer) {
    console.error("No customer found, skipping validation");
    return { operations: [{ validationAdd: { errors } }] };
  }

  // Get max_amount value from customer metafield
  const maxAmountStr = customer.metafield?.value;
  console.error("Customer metafield value:", maxAmountStr);

  if (maxAmountStr) {
    const maxAmount = parseFloat(maxAmountStr);
    console.error("Max amount:", maxAmount);
    console.error("Comparison: cartTotal > maxAmount =>", cartTotal, ">", maxAmount, "=>", cartTotal > maxAmount);

    // Check if cart total exceeds the limit
    if (!isNaN(maxAmount) && cartTotal > maxAmount) {
      console.error("VALIDATION FAILED: Cart total exceeds limit!");
      errors.push({
        message: `Cart total (${cartTotal.toLocaleString('en-US')}) exceeds the maximum limit (${maxAmount.toLocaleString('en-US')}) for your account.`,
        target: "$.cart",
      });
    } else {
      console.error("VALIDATION PASSED: Cart total is within limit");
    }
  } else {
    console.error("No metafield value found, skipping validation");
  }

  const operations = [
    {
      validationAdd: {
        errors
      },
    },
  ];

  console.error("Total errors:", errors.length);
  console.error("=== END CART VALIDATION ===");

  return {operations};
};
