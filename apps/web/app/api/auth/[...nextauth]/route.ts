import { handlers } from '@/auth';
import { authConfig } from '@/lib/core/auth.config';
import { companyAuthHandler } from '@/lib/features/company/auth-handler.server';
import type { NextRequest } from 'next/server';

export const GET = (request: NextRequest) => companyAuthHandler(request, authConfig, handlers.GET);
export const POST = (request: NextRequest) => companyAuthHandler(request, authConfig, handlers.POST);
