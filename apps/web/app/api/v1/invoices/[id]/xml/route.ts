import { NextRequest } from 'next/server';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { recordError } from '@/lib/features/records/http';
import { invoiceXml } from '@/lib/features/finance/invoices.server';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

/** The invoice's UBL-TR XML as a download (finance roles only; unsigned, the provider signs). */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const { filename, xml } = await invoiceXml(await requireWorkOrderActor(), id);
    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename.replace(/[^A-Za-z0-9_.-]/g, '')}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    return recordError(e, 'invoice-xml');
  }
}
