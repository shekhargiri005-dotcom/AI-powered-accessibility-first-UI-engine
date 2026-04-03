import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function GET(request: Request) {
  const reqLogger = logger.createRequestLogger('/api/usage');
  reqLogger.info('Fetching usage statistics');

  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');

    // Time filter: default to last 30 days
    const daysStr = searchParams.get('days') || '30';
    const days = parseInt(daysStr, 10) || 30;
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);

    const whereClause: any = {
      createdAt: { gte: sinceDate }
    };

    if (workspaceId) {
      whereClause.workspaceId = workspaceId;
    }

    const usageLogs = await prisma.usageLog.findMany({
      where: whereClause,
      select: {
        provider: true,
        model: true,
        promptTokens: true,
        completionTokens: true,
        totalTokens: true,
        costUsd: true,
        cached: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // Aggregate stats
    const aggregated = {
      totalCostUsd: 0,
      totalRequests: usageLogs.length,
      totalTokens: 0,
      cachedRequests: 0,
      byProvider: {} as Record<string, { requests: number; cost: number; tokens: number }>,
      byModel: {} as Record<string, { requests: number; cost: number; tokens: number }>
    };

    usageLogs.forEach(log => {
      aggregated.totalCostUsd += log.costUsd;
      aggregated.totalTokens += log.totalTokens;
      if (log.cached) aggregated.cachedRequests++;

      // Provider aggregation
      if (!aggregated.byProvider[log.provider]) {
        aggregated.byProvider[log.provider] = { requests: 0, cost: 0, tokens: 0 };
      }
      aggregated.byProvider[log.provider].requests++;
      aggregated.byProvider[log.provider].cost += log.costUsd;
      aggregated.byProvider[log.provider].tokens += log.totalTokens;

      // Model aggregation
      if (!aggregated.byModel[log.model]) {
        aggregated.byModel[log.model] = { requests: 0, cost: 0, tokens: 0 };
      }
      aggregated.byModel[log.model].requests++;
      aggregated.byModel[log.model].cost += log.costUsd;
      aggregated.byModel[log.model].tokens += log.totalTokens;
    });

    reqLogger.end('Usage statistics fetched successfully', { totalRequests: aggregated.totalRequests });

    return NextResponse.json({
      success: true,
      timeframe: { days, sinceDate },
      summary: {
        totalRequests: aggregated.totalRequests,
        cachedRequests: aggregated.cachedRequests,
        totalTokens: aggregated.totalTokens,
        totalCostUsd: Number(aggregated.totalCostUsd.toFixed(4)),
      },
      byProvider: aggregated.byProvider,
      byModel: aggregated.byModel,
      recentLogs: usageLogs.slice(0, 100) // Return up to 100 recent rows limit for detailed view
    });

  } catch (err) {
    reqLogger.error('Failed to fetch usage statistics', err);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch usage statistics' },
      { status: 500 }
    );
  }
}
