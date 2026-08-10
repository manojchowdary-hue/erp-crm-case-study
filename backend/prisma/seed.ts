import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("Password@123", 10);

  const users = [
    { name: "Admin User", email: "admin@erp.test", role: "ADMIN" as const },
    { name: "Sales User", email: "sales@erp.test", role: "SALES" as const },
    { name: "Warehouse User", email: "warehouse@erp.test", role: "WAREHOUSE" as const },
    { name: "Accounts User", email: "accounts@erp.test", role: "ACCOUNTS" as const },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, password },
    });
  }

  const customer = await prisma.customer.upsert({
    where: { id: "seed-customer-1" },
    update: {},
    create: {
      id: "seed-customer-1",
      name: "Ramesh Traders",
      mobile: "9876543210",
      email: "ramesh@traders.test",
      businessName: "Ramesh Traders Pvt Ltd",
      customerType: "WHOLESALE",
      status: "ACTIVE",
      address: "Ahmedabad, Gujarat",
    },
  });

  const product = await prisma.product.upsert({
    where: { sku: "SKU-001" },
    update: {},
    create: {
      name: "Sample Product A",
      sku: "SKU-001",
      category: "General",
      unitPrice: 250.0,
      currentStock: 100,
      minStockAlert: 10,
      location: "Warehouse 1",
    },
  });

  console.log("Seed complete.");
  console.log("Login credentials (all roles use password: Password@123):");
  users.forEach((u) => console.log(`  ${u.role}: ${u.email}`));
  console.log(`Sample customer: ${customer.name}`);
  console.log(`Sample product: ${product.name} (${product.sku})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
