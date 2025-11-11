export interface Customer {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  metafield: {
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
