export interface Customer {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  cartLimitMetafield: {
    value: string;
  } | null;
  annualLimitMetafield: {
    value: string;
  } | null;
  annualSpentMetafield: {
    value: string;
  } | null;
}

export interface LoaderData {
  customers: Customer[];
}

export interface ActionResponse {
  success: boolean;
  error?: string;
  message?: string;
  metafield?: any;
  totalUpdated?: number;
}
