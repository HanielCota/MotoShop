import { createLoader, parseAsString } from "nuqs/server";

export const customerAddressSearchParams = {
  addressQ: parseAsString,
};

export const loadCustomerAddressSearchParams = createLoader(customerAddressSearchParams);
