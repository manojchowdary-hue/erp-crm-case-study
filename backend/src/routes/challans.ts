import { Router } from "express";
import { z } from "zod";
import prisma from "../prismaClient";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const itemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
});

const createChallanSchema = z.object({
  customerId: z.string().min(1),
  items: z.array(itemSchema).min(1),
  status: z.enum(["DRAFT", "CONFIRMED"]).default("DRAFT"),
});

async function generateChallanNumber() {
  const year = new Date().getFullYear();
  const count = await prisma.challan.count();
  return `CH-${year}-${String(count + 1).padStart(5, "0")}`;
}

// GET /challans?status=&customerId=&page=&pageSize=
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { status, customerId, page = "1", pageSize = "20" } = req.query as Record<string, string>;
    const take = Math.min(parseInt(pageSize) || 20, 100);
    const skip = (Math.max(parseInt(page) || 1, 1) - 1) * take;

    const where: any = {};
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;

    const [items, total] = await Promise.all([
      prisma.challan.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: "desc" },
        include: { customer: true, items: true },
      }),
      prisma.challan.count({ where }),
    ]);

    res.json({ items, total, page: Number(page), pageSize: take });
  })
);

// GET /challans/:id
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const challan = await prisma.challan.findUnique({
      where: { id: req.params.id },
      include: { customer: true, items: true, createdBy: true },
    });
    if (!challan) return res.status(404).json({ error: "Challan not found" });
    res.json(challan);
  })
);

// POST /challans  -- create as Draft or Confirmed
router.post(
  "/",
  requireRole("ADMIN", "SALES"),
  asyncHandler(async (req, res) => {
    const parsed = createChallanSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }
    const { customerId, items, status } = parsed.data;

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    const productIds = items.map((i) => i.productId);
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
    if (products.length !== productIds.length) {
      return res.status(404).json({ error: "One or more products not found" });
    }

    // If confirming immediately, validate stock BEFORE writing anything
    if (status === "CONFIRMED") {
      for (const item of items) {
        const product = products.find((p) => p.id === item.productId)!;
        if (product.currentStock < item.quantity) {
          return res.status(400).json({
            error: `Insufficient stock for product "${product.name}" (SKU: ${product.sku}). Available: ${product.currentStock}, requested: ${item.quantity}`,
          });
        }
      }
    }

    const challanNumber = await generateChallanNumber();
    const totalQuantity = items.reduce((sum, i) => sum + i.quantity, 0);

    const result = await prisma.$transaction(async (tx) => {
      const challan = await tx.challan.create({
        data: {
          challanNumber,
          customerId,
          status,
          totalQuantity,
          createdById: req.user?.id,
          items: {
            create: items.map((item) => {
              const product = products.find((p) => p.id === item.productId)!;
              return {
                productId: product.id,
                productNameSnapshot: product.name,
                productSkuSnapshot: product.sku,
                unitPriceSnapshot: product.unitPrice,
                quantity: item.quantity,
              };
            }),
          },
        },
        include: { items: true, customer: true },
      });

      if (status === "CONFIRMED") {
        for (const item of items) {
          const product = products.find((p) => p.id === item.productId)!;
          await tx.product.update({
            where: { id: product.id },
            data: { currentStock: { decrement: item.quantity } },
          });
          await tx.stockMovement.create({
            data: {
              productId: product.id,
              quantityChanged: item.quantity,
              movementType: "OUT",
              reason: `Sales Challan ${challanNumber}`,
              createdById: req.user?.id,
            },
          });
        }
      }

      return challan;
    });

    res.status(201).json(result);
  })
);

// PUT /challans/:id/confirm  -- confirm a draft challan (reduces stock)
router.put(
  "/:id/confirm",
  requireRole("ADMIN", "SALES"),
  asyncHandler(async (req, res) => {
    const challan = await prisma.challan.findUnique({
      where: { id: req.params.id },
      include: { items: true },
    });
    if (!challan) return res.status(404).json({ error: "Challan not found" });
    if (challan.status !== "DRAFT") {
      return res.status(400).json({ error: `Only DRAFT challans can be confirmed. Current status: ${challan.status}` });
    }

    const productIds = challan.items.map((i) => i.productId);
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } });

    for (const item of challan.items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product || product.currentStock < item.quantity) {
        return res.status(400).json({
          error: `Insufficient stock for "${item.productNameSnapshot}". Available: ${product?.currentStock ?? 0}, required: ${item.quantity}`,
        });
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      for (const item of challan.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { currentStock: { decrement: item.quantity } },
        });
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            quantityChanged: item.quantity,
            movementType: "OUT",
            reason: `Sales Challan ${challan.challanNumber}`,
            createdById: req.user?.id,
          },
        });
      }
      return tx.challan.update({
        where: { id: challan.id },
        data: { status: "CONFIRMED" },
        include: { items: true, customer: true },
      });
    });

    res.json(updated);
  })
);

// PUT /challans/:id/cancel
router.put(
  "/:id/cancel",
  requireRole("ADMIN", "SALES"),
  asyncHandler(async (req, res) => {
    const challan = await prisma.challan.findUnique({ where: { id: req.params.id }, include: { items: true } });
    if (!challan) return res.status(404).json({ error: "Challan not found" });
    if (challan.status === "CANCELLED") {
      return res.status(400).json({ error: "Challan is already cancelled" });
    }

    const wasConfirmed = challan.status === "CONFIRMED";

    const updated = await prisma.$transaction(async (tx) => {
      // If it was confirmed, restock the items since the sale is being reversed
      if (wasConfirmed) {
        for (const item of challan.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { currentStock: { increment: item.quantity } },
          });
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              quantityChanged: item.quantity,
              movementType: "IN",
              reason: `Cancellation of Challan ${challan.challanNumber}`,
              createdById: req.user?.id,
            },
          });
        }
      }
      return tx.challan.update({
        where: { id: challan.id },
        data: { status: "CANCELLED" },
        include: { items: true, customer: true },
      });
    });

    res.json(updated);
  })
);

export default router;
