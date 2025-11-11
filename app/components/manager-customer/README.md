# Manager Customer Components

This directory contains all the components used in the Customer Manager feature.

## Structure

```
manager-customer/
├── types.ts                    # Shared TypeScript interfaces
├── ConfirmModal.tsx            # Confirmation modal for bulk updates
├── EditCustomerModal.tsx       # Modal for editing individual customer metafield
├── BulkUpdateSection.tsx       # Section for bulk updating all customers
├── EditableMetafieldCell.tsx   # Table cell component with edit functionality
├── index.ts                    # Export barrel file
└── README.md                   # This file
```

## Components

### `ConfirmModal`
A reusable confirmation modal used before performing bulk updates.

**Props:**
- `isOpen: boolean` - Controls modal visibility
- `onClose: () => void` - Callback when modal is closed
- `onConfirm: () => void` - Callback when user confirms the action
- `value: string` - The value to be updated (displayed in confirmation message)

### `EditCustomerModal`
Modal for editing the max amount metafield for a single customer.

**Props:**
- `isOpen: boolean` - Controls modal visibility
- `onClose: () => void` - Callback when modal is closed
- `customer: Customer` - Customer object
- `fetcher: FetcherWithComponents<any>` - React Router fetcher for form submission
- `shopify: any` - Shopify App Bridge instance

### `BulkUpdateSection`
Section component that allows updating the max amount for all customers at once.

**Features:**
- Input field for entering value
- Validation for positive numbers
- Confirmation modal before updating
- Toast notifications for success/error states
- Automatic page reload after successful update

### `EditableMetafieldCell`
Table cell component that displays the metafield value with an edit button.

**Props:**
- `customer: Customer` - Customer object

**Features:**
- Displays current metafield value or "Not set"
- Edit button that opens EditCustomerModal
- Uses unique fetcher key per customer

## Types

### `Customer`
```typescript
interface Customer {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  metafield: {
    value: string;
  } | null;
}
```

### `LoaderData`
```typescript
interface LoaderData {
  customers: Customer[];
}
```

### `ActionResponse`
```typescript
interface ActionResponse {
  success: boolean;
  error?: string;
  message?: string;
  metafield?: any;
  totalUpdated?: number;
}
```

## Usage

Import components from the barrel file:

```typescript
import {
  BulkUpdateSection,
  EditableMetafieldCell,
  type Customer,
  type LoaderData
} from "../components/manager-customer";
```

## Notes

- All components use inline styles for consistency with Shopify Polaris design
- Components use React Router's `useFetcher` for form submissions without navigation
- Toast notifications are handled via Shopify App Bridge
- Modal components use backdrop click and ESC key for closing
- All text is in English
