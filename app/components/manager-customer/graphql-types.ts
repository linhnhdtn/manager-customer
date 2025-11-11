// Shopify Admin GraphQL Client Type
export interface AdminGraphQL {
  graphql: <T = any>(query: string, options?: { variables?: Record<string, any> }) => Promise<GraphQLResponse<T>>;
}

// Generic GraphQL Response
export interface GraphQLResponse<T> {
  json: () => Promise<GraphQLResponseData<T>>;
}

export interface GraphQLResponseData<T> {
  data?: T;
  errors?: GraphQLError[];
}

export interface GraphQLError {
  message: string;
  field?: string;
}

// GraphQL Edge/Node Pattern
export interface Edge<T> {
  node: T;
}

export interface PageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

// Metafield Definition Types
export interface MetafieldDefinitionNode {
  id: string;
  namespace: string;
  key: string;
  name: string;
}

export interface MetafieldDefinitionsData {
  metafieldDefinitions: {
    edges: Edge<MetafieldDefinitionNode>[];
  };
}

export interface MetafieldDefinitionCreateData {
  metafieldDefinitionCreate: {
    createdDefinition: {
      id: string;
      namespace: string;
      key: string;
    } | null;
    userErrors: UserError[];
  };
}

// Customer Query Types
export interface CustomerNode {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  metafield: {
    value: string;
  } | null;
}

export interface CustomersData {
  customers: {
    edges: Edge<CustomerNode>[];
    pageInfo: PageInfo;
  };
}

export interface CustomerIdNode {
  id: string;
}

export interface CustomerIdsData {
  customers: {
    edges: Edge<CustomerIdNode>[];
  };
}

// Metafield Mutation Types
export interface MetafieldsSetData {
  metafieldsSet: {
    metafields: Array<{
      id: string;
      namespace?: string;
      key?: string;
      value?: string;
    }> | null;
    userErrors: UserError[];
  };
}

export interface UserError {
  field: string[];
  message: string;
}

// Metafield Input Types
export interface MetafieldsSetInput {
  ownerId: string;
  namespace: string;
  key: string;
  value: string;
  type: string;
}

export interface MetafieldDefinitionInput {
  name: string;
  namespace: string;
  key: string;
  description: string;
  type: string;
  ownerType: string;
}
