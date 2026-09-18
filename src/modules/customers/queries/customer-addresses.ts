import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/database";

export type CustomerAddress = {
  id: string;
  label: string;
  recipient: string;
  postalCode: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  country: string;
  isDefault: boolean;
};

export async function listCustomerAddresses(userId: string, input: { query?: string | null } = {}): Promise<CustomerAddress[]> {
  const query = input.query?.trim().slice(0, 100);
  const where: Prisma.CustomerAddressWhereInput = {
    userId,
    ...(query
      ? {
          OR: [
            { label: { contains: query, mode: "insensitive" } },
            { recipient: { contains: query, mode: "insensitive" } },
            { postalCode: { contains: query, mode: "insensitive" } },
            { street: { contains: query, mode: "insensitive" } },
            { city: { contains: query, mode: "insensitive" } },
            { state: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  return db.customerAddress.findMany({
    where,
    select: {
      id: true,
      label: true,
      recipient: true,
      postalCode: true,
      street: true,
      number: true,
      complement: true,
      neighborhood: true,
      city: true,
      state: true,
      country: true,
      isDefault: true,
    },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
}
