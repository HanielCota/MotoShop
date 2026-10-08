import type { getCustomerOrder } from "@/modules/returns/queries/customer-orders";

export type CustomerOrderDetail = NonNullable<Awaited<ReturnType<typeof getCustomerOrder>>>;
export type CustomerSellerOrder = CustomerOrderDetail["sellerOrders"][number];
export type CustomerOrderItem = CustomerSellerOrder["items"][number];
export type CustomerOrderPayment = CustomerOrderDetail["payments"][number];
export type CustomerShipment = NonNullable<CustomerSellerOrder["shipment"]>;
