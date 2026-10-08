import {
  AwningConfigurationSchema,
  AwningPreviewSchema,
} from "@/lib/features/awning/configuration";
import { z } from "zod";
import { CurrencySchema } from "@/lib/types/currency";
import { ConfigurationChoiceSchema, type ProductConfiguration } from "@/lib/features/products/configuration";

export const QuotationItemSchema = z.object({
  awningConfiguration: AwningConfigurationSchema.optional(),
  awningPreview: AwningPreviewSchema.optional(),
  projectionMm: z.coerce.number().positive().optional(),
  mountingHeightMm: z.coerce.number().positive().optional(),
  id: z.string().uuid().optional(),
  productName: z.string().min(1, "Ürün adı gerekli"),
  description: z.string().optional(),
  color: z.string().optional(),
  widthMm: z.coerce.number().positive().optional(),
  heightMm: z.coerce.number().positive().optional(),
  quantity: z.coerce
    .number()
    .int()
    .positive("Miktar pozitif olmalı")
    .default(1),
  unitPrice: z.coerce.number().nonnegative().default(0),
  discountPercent: z.coerce.number().min(0).max(100).default(0),
  totalPrice: z.coerce.number().nonnegative().default(0),
  notes: z.string().optional(),
  /** A configured product (pergola, …): the seller's choice; the server fills in BOM and price. */
  productConfiguration: ConfigurationChoiceSchema.passthrough()
    .transform((c) => c as typeof c & Partial<ProductConfiguration>)
    .optional(),
});

/** The order made from a quote, and the work orders its configured lines got (or why not yet). */
export type ConversionResult = {
  orderId: string;
  workOrders?: Array<{ id: string; orderItemId: string; title: string; assignedTo: string }>;
  pendingWorkOrders?: Array<{ orderItemId: string; productName: string; reason: string }>;
};

export const QuotationSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  quotationNumber: z.string(),
  version: z.number().int().positive().default(1),
  customerId: z.string().uuid().optional().nullable(),
  customerName: z.string(),
  status: z.enum([
    "draft",
    "sent",
    "accepted",
    "rejected",
    "expired",
    "converted",
  ]),
  validUntil: z.string().optional().nullable(),
  currency: CurrencySchema,
  discountPercent: z.number().default(0),
  subtotal: z.number().default(0),
  discountAmount: z.number().default(0),
  taxAmount: z.number().default(0),
  totalAmount: z.number().default(0),
  notes: z.string().optional().nullable(),
  internalNotes: z.string().optional().nullable(),
  termsAndConditions: z.string().optional().nullable(),
  convertedToOrderId: z.string().uuid().optional().nullable(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
  items: z.array(QuotationItemSchema).default([]),
});

export type Quotation = z.infer<typeof QuotationSchema>;
export type QuotationItem = z.infer<typeof QuotationItemSchema>;

export const CreateQuotationSchema = z.object({
  idempotencyKey: z.string().uuid().optional(),
  expectedVersion: z.number().int().positive().optional(),
  customerId: z.string().uuid().optional(),
  customerName: z.string().min(1, "Müşteri adı gerekli"),
  validUntil: z
    .string()
    .regex(/^(\d{4})-(\d{2})-(\d{2})$/)
    .optional(),
  currency: CurrencySchema.default("TRY"),
  discountPercent: z.coerce.number().min(0).max(100).default(0),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
  termsAndConditions: z.string().optional(),
  items: z.array(QuotationItemSchema).min(1).max(100),
});

export type CreateQuotationInput = z.infer<typeof CreateQuotationSchema>;

export interface IQuotationService {
  getQuotations(tenantId: string): Promise<Quotation[]>;
  getQuotationById(tenantId: string, id: string): Promise<Quotation | null>;
  createQuotation(
    tenantId: string,
    data: CreateQuotationInput,
    createdBy?: string,
  ): Promise<Quotation>;
  updateQuotation(
    tenantId: string,
    id: string,
    data: Partial<CreateQuotationInput>,
  ): Promise<Quotation>;
  updateStatus(
    tenantId: string,
    id: string,
    status: Quotation["status"],
    expectedVersion?: number,
    actorId?: string,
  ): Promise<Quotation>;
  convertToOrder(
    tenantId: string,
    id: string,
    createdBy?: string,
    expectedVersion?: number,
    actorRole?: string,
  ): Promise<ConversionResult>;
  deleteQuotation(tenantId: string, id: string): Promise<void>;
}
