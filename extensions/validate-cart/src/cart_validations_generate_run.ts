import type {
  CartValidationsGenerateRunInput,
  CartValidationsGenerateRunResult,
  ValidationError
} from "../generated/api";

export function cartValidationsGenerateRun(input: CartValidationsGenerateRunInput): CartValidationsGenerateRunResult {
  // Log toàn bộ input để debug
  console.error("=== CART VALIDATION INPUT ===");
  console.error("Full input:", JSON.stringify(input, null, 2));

  const errors: ValidationError[] = [];

  // Lấy tổng giá tiền từ cart
  const cartTotal = parseFloat(input.cart.cost.subtotalAmount.amount);
  console.error("Cart total:", cartTotal);

  // Lấy customer từ buyerIdentity
  const customer = input.cart.buyerIdentity?.customer;
  console.error("Customer:", customer ? "Logged in" : "Not logged in");

  // Nếu không có customer (chưa đăng nhập), bỏ qua validation
  if (!customer) {
    console.error("No customer found, skipping validation");
    return { operations: [{ validationAdd: { errors } }] };
  }

  // Lấy giá trị max_amount từ customer metafield
  const maxAmountStr = customer.metafield?.value;
  console.error("Customer metafield value:", maxAmountStr);

  if (maxAmountStr) {
    const maxAmount = parseFloat(maxAmountStr);
    console.error("Max amount:", maxAmount);
    console.error("Comparison: cartTotal > maxAmount =>", cartTotal, ">", maxAmount, "=>", cartTotal > maxAmount);

    // Kiểm tra nếu tổng giá tiền vượt quá giới hạn
    if (!isNaN(maxAmount) && cartTotal > maxAmount) {
      console.error("VALIDATION FAILED: Cart total exceeds limit!");
      errors.push({
        message: `Tổng giá trị đơn hàng (${cartTotal.toLocaleString('vi-VN')} đ) vượt quá giới hạn tối đa (${maxAmount.toLocaleString('vi-VN')} đ)`,
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
