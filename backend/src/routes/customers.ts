import { Router } from "express";
import { z } from "zod";
import prisma from "../prismaClient";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const customerSchema = z.object({
  name: z.string().min(1),
  mobile: z.string().min(6),
  email: z.string().email().optional().nullable(),
  businessName: z.string().optional().nullable(),
  gstNumber: z.string().optional().nullable(),
  customerType: z.enum(["RETAIL", "WHOLESALE", "DISTRIBUTOR"]).default("RETAIL"),
  address: z.string().optional().nullable(),
  status: z.enum(["LEAD", "ACTIVE", "INACTIVE"]).default("LEAD"),
  followUpDate: z.string().datetime().optional().nullable(),
});

// GET /customers?search=&status=&page=&pageSize=
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { search, status, customerType, page = "1", pageSize = "20" } = req.query as Record<string, string>;
    const take = Math.min(parseInt(pageSize) || 20, 100);
    const skip = (Math.max(parseInt(page) || 1, 1) - 1) * take;

    const where: any = {};
    if (status) where.status = status;
    if (customerType) where.customerType = customerType;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { mobile: { contains: search } },
        { email: { contains: search, mode: "insensitive" } },
        { businessName: { contains: search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.customer.findMany({ where, take, skip, orderBy: { createdAt: "desc" } }),
      prisma.customer.count({ where }),
    ]);

    res.json({ items, total, page: Number(page), pageSize: take });
  })
);

// GET /customers/:id (with notes)
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id },
      include: { notes: { orderBy: { createdAt: "desc" } }, challans: true },
    });
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    res.json(customer);
  })
);

// POST /customers
router.post(
  "/",
  requireRole("ADMIN", "SALES"),
  asyncHandler(async (req, res) => {
    const parsed = customerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }
    const customer = await prisma.customer.create({ data: parsed.data as any });
    res.status(201).json(customer);
  })
);

// PUT /customers/:id
router.put(
  "/:id",
  requireRole("ADMIN", "SALES"),
  asyncHandler(async (req, res) => {
    const parsed = customerSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }
    const exists = await prisma.customer.findUnique({ where: { id: req.params.id } });
    if (!exists) return res.status(404).json({ error: "Customer not found" });

    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data: parsed.data as any,
    });
    res.json(customer);
  })
);

// POST /customers/:id/notes
router.post(
  "/:id/notes",
  requireRole("ADMIN", "SALES"),
  asyncHandler(async (req, res) => {
    const schema = z.object({ note: z.string().min(1) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }
    const customer = await prisma.customer.findUnique({ where: { id: req.params.id } });
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    const note = await prisma.customerNote.create({
      data: {
        customerId: req.params.id,
        note: parsed.data.note,
        createdById: req.user?.id,
      },
    });
    res.status(201).json(note);
  })
);

export default router;
