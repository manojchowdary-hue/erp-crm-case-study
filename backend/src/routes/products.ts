import { Router } from "express";
import { z } from "zod";
import prisma from "../prismaClient";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const productSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  category: z.string().optional().nullable(),
  unitPrice: z.number().nonnegative(),
  currentStock: z.number().int().nonnegative().default(0),
  minStockAlert: z.number().int().nonnegative().default(0),
  location: z.string().optional().nullable(),
});

// GET /products?search=&lowStock=true&page=&pageSize=
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { search, lowStock, page = "1", pageSize = "20" } = req.query as Record<string, string>;
    const take = Math.min(parseInt(pageSize) || 20, 100);
    const skip = (Math.max(parseInt(page) || 1, 1) - 1) * take;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
        { category: { contains: search, mode: "insensitive" } },
      ];
    }

    let items = await prisma.product.findMany({ where, take, skip, orderBy: { createdAt: "desc" } });
    const total = await prisma.product.count({ where });

    if (lowStock === "true") {
      items = items.filter((p) => p.currentStock <= p.minStockAlert);
    }

    res.json({ items, total, page: Number(page), pageSize: take });
  })
);

// GET /products/:id (with stock movement history)
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: { stockMovements: { orderBy: { timestamp: "desc" }, take: 50 } },
    });
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  })
);

// POST /products
router.post(
  "/",
  requireRole("ADMIN", "WAREHOUSE"),
  asyncHandler(async (req, res) => {
    const parsed = productSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }
    const existingSku = await prisma.product.findUnique({ where: { sku: parsed.data.sku } });
    if (existingSku) return res.status(409).json({ error: "SKU already exists" });

    const product = await prisma.product.create({ data: parsed.data });
    res.status(201).json(product);
  })
);

// PUT /products/:id
router.put(
  "/:id",
  requireRole("ADMIN", "WAREHOUSE"),
  asyncHandler(async (req, res) => {
    const parsed = productSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }
    const exists = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!exists) return res.status(404).json({ error: "Product not found" });

    const product = await prisma.product.update({ where: { id: req.params.id }, data: parsed.data });
    res.json(product);
  })
);

// POST /products/:id/stock-movements  -- manual stock adjustment (IN/OUT)
router.post(
  "/:id/stock-movements",
  requireRole("ADMIN", "WAREHOUSE"),
  asyncHandler(async (req, res) => {
    const schema = z.object({
      quantityChanged: z.number().int().positive(),
      movementType: z.enum(["IN", "OUT"]),
      reason: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }

    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!product) return res.status(404).json({ error: "Product not found" });

    const { quantityChanged, movementType, reason } = parsed.data;
    const delta = movementType === "IN" ? quantityChanged : -quantityChanged;
    const newStock = product.currentStock + delta;

    if (newStock < 0) {
      return res.status(400).json({ error: "Stock cannot go negative" });
    }

    const [movement] = await prisma.$transaction([
      prisma.stockMovement.create({
        data: {
          productId: product.id,
          quantityChanged,
          movementType,
          reason,
          createdById: req.user?.id,
        },
      }),
      prisma.product.update({ where: { id: product.id }, data: { currentStock: newStock } }),
    ]);

    res.status(201).json(movement);
  })
);

export default router;
