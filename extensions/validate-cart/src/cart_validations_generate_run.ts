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

  // Check Cart Limits (cart_limits.max_amount)
  const cartLimitsMaxAmountStr = customer.cartLimitsMaxAmount?.value;
  console.error("Cart Limits max_amount:", cartLimitsMaxAmountStr);

  if (cartLimitsMaxAmountStr) {
    const cartLimitsMaxAmount = parseFloat(cartLimitsMaxAmountStr);
    console.error("Cart Limits max amount:", cartLimitsMaxAmount);
    console.error("Comparison: cartTotal > cartLimitsMaxAmount =>", cartTotal, ">", cartLimitsMaxAmount, "=>", cartTotal > cartLimitsMaxAmount);

    // Check if cart total exceeds the cart limit
    if (!isNaN(cartLimitsMaxAmount) && cartTotal > cartLimitsMaxAmount) {
      console.error("VALIDATION FAILED: Cart total exceeds cart limit!");
      errors.push({
        message: `Cart total ($${cartTotal.toLocaleString('en-US')}) exceeds the maximum cart limit ($${cartLimitsMaxAmount.toLocaleString('en-US')}) for your account.`,
        target: "$.cart",
      });
    } else {
      console.error("VALIDATION PASSED: Cart total is within cart limit");
    }
  } else {
    console.error("No cart_limits.max_amount metafield found");
  }

  // Check Annual Purchase Limit (annual_purchase_limit.max_amount)
  const annualPurchaseLimitMaxAmountStr = customer.annualPurchaseLimitMaxAmount?.value;
  console.error("Annual Purchase Limit max_amount:", annualPurchaseLimitMaxAmountStr);

  if (annualPurchaseLimitMaxAmountStr) {
    const annualPurchaseLimitMaxAmount = parseFloat(annualPurchaseLimitMaxAmountStr);
    console.error("Annual Purchase Limit max amount:", annualPurchaseLimitMaxAmount);
    console.error("Comparison: cartTotal > annualPurchaseLimitMaxAmount =>", cartTotal, ">", annualPurchaseLimitMaxAmount, "=>", cartTotal > annualPurchaseLimitMaxAmount);

    // Check if cart total exceeds the annual purchase limit
    if (!isNaN(annualPurchaseLimitMaxAmount) && cartTotal > annualPurchaseLimitMaxAmount) {
      console.error("VALIDATION FAILED: Cart total exceeds Annual Purchase Limit!");
      errors.push({
        message: `Cart total ($${cartTotal.toLocaleString('en-US')}) exceeds your Annual Purchase Limit ($${annualPurchaseLimitMaxAmount.toLocaleString('en-US')}).`,
        target: "$.cart",
      });
    } else {
      console.error("VALIDATION PASSED: Cart total is within Annual Purchase Limit");
    }
  } else {
    console.error("No annual_purchase_limit.max_amount metafield found");
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
