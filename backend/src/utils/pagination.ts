/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Pagination utilities for handling large datasets efficiently
 */

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export class PaginationHelper {
  /**
   * Default pagination settings
   */
  static readonly DEFAULT_LIMIT = 20;
  static readonly MAX_LIMIT = 100;
  static readonly DEFAULT_PAGE = 1;

  /**
   * Parse and validate pagination parameters
   */
  static parseParams(params: PaginationParams): {
    page: number;
    limit: number;
    skip: number;
    sortBy?: string;
    sortOrder: 'asc' | 'desc';
  } {
    const page = Math.max(1, parseInt(String(params.page)) || this.DEFAULT_PAGE);
    const limit = Math.min(
      this.MAX_LIMIT,
      Math.max(1, parseInt(String(params.limit)) || this.DEFAULT_LIMIT)
    );
    const skip = (page - 1) * limit;
    const sortOrder = params.sortOrder === 'asc' ? 'asc' : 'desc';

    return {
      page,
      limit,
      skip,
      sortBy: params.sortBy,
      sortOrder
    };
  }

  /**
   * Create paginated response
   */
  static createResponse<T>(
    data: T[],
    totalItems: number,
    page: number,
    limit: number
  ): PaginatedResponse<T> {
    const totalPages = Math.ceil(totalItems / limit);
    
    return {
      data,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    };
  }

  /**
   * Get Prisma orderBy clause from sort parameters
   */
  static getPrismaOrderBy(sortBy?: string, sortOrder: 'asc' | 'desc' = 'desc'): any {
    if (!sortBy) {
      return { createdAt: 'desc' }; // Default sort
    }

    // Handle nested sorting (e.g., "user.name")
    if (sortBy.includes('.')) {
      const [relation, field] = sortBy.split('.');
      return { [relation]: { [field]: sortOrder } };
    }

    return { [sortBy]: sortOrder };
  }

  /**
   * Paginate activities with optimized queries
   */
  static async paginateActivities(
    prisma: any,
    whereClause: any,
    params: PaginationParams
  ): Promise<PaginatedResponse<any>> {
    const { page, limit, skip, sortBy, sortOrder } = this.parseParams(params);
    const orderBy = this.getPrismaOrderBy(sortBy, sortOrder);

    // Execute count and data queries in parallel
    const [totalItems, data] = await Promise.all([
      prisma.activityEvent.count({ where: whereClause }),
      prisma.activityEvent.findMany({
        where: whereClause,
        orderBy,
        skip,
        take: limit,
        select: {
          id: true,
          userId: true,
          cycleId: true,
          activityType: true,
          contributionType: true,
          status: true,
          description: true,
          proofLink: true,
          hoursLogged: true,
          createdAt: true,
          verifiedAt: true,
          rejectionReason: true,
          feedbackComment: true,
          calculatedOwnership: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          cycle: {
            select: {
              id: true,
              name: true,
              state: true
            }
          }
        }
      })
    ]);

    return this.createResponse(data, totalItems, page, limit);
  }

  /**
   * Paginate ownership ledger entries
   */
  static async paginateOwnershipLedger(
    prisma: any,
    whereClause: any,
    params: PaginationParams
  ): Promise<PaginatedResponse<any>> {
    const { page, limit, skip, sortBy, sortOrder } = this.parseParams(params);
    const orderBy = this.getPrismaOrderBy(sortBy || 'createdAt', sortOrder);

    const [totalItems, data] = await Promise.all([
      prisma.ownershipLedger.count({ where: whereClause }),
      prisma.ownershipLedger.findMany({
        where: whereClause,
        orderBy,
        skip,
        take: limit,
        select: {
          id: true,
          userId: true,
          cycleId: true,
          eventType: true,
          ownershipAmount: true,
          multiplierSnapshot: true,
          sourceReference: true,
          createdAt: true,
          createdBy: true
        }
      })
    ]);

    return this.createResponse(data, totalItems, page, limit);
  }

  /**
   * Paginate cycle messages
   */
  static async paginateMessages(
    prisma: any,
    cycleId: string,
    params: PaginationParams
  ): Promise<PaginatedResponse<any>> {
    const { page, limit, skip } = this.parseParams(params);

    const [totalItems, data] = await Promise.all([
      prisma.cycleMessage.count({ where: { cycleId } }),
      prisma.cycleMessage.findMany({
        where: { cycleId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          message: true,
          mentions: true,
          createdAt: true,
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              profile: {
                select: {
                  avatar: true
                }
              }
            }
          }
        }
      })
    ]);

    // Reverse messages to show oldest first (for chat-like display)
    data.reverse();

    return this.createResponse(data, totalItems, page, limit);
  }

  /**
   * Paginate audit logs
   */
  static async paginateAuditLogs(
    prisma: any,
    whereClause: any,
    params: PaginationParams
  ): Promise<PaginatedResponse<any>> {
    const { page, limit, skip, sortBy, sortOrder } = this.parseParams(params);
    const orderBy = this.getPrismaOrderBy(sortBy || 'timestamp', sortOrder);

    const [totalItems, data] = await Promise.all([
      prisma.auditTrail.count({ where: whereClause }),
      prisma.auditTrail.findMany({
        where: whereClause,
        orderBy,
        skip,
        take: limit,
        include: {
          admin: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          targetUser: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      })
    ]);

    return this.createResponse(data, totalItems, page, limit);
  }

  /**
   * Paginate cycle participants
   */
  static async paginateParticipants(
    prisma: any,
    cycleId: string,
    params: PaginationParams
  ): Promise<PaginatedResponse<any>> {
    const { page, limit, skip, sortBy, sortOrder } = this.parseParams(params);
    const orderBy = this.getPrismaOrderBy(sortBy || 'createdAt', sortOrder);

    const [totalItems, data] = await Promise.all([
      prisma.cycleParticipation.count({ 
        where: { cycleId, optedIn: true } 
      }),
      prisma.cycleParticipation.findMany({
        where: { cycleId, optedIn: true },
        orderBy,
        skip,
        take: limit,
        select: {
          id: true,
          userId: true,
          stallStage: true,
          participationStatus: true,
          lastActivityDate: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              profile: {
                select: {
                  avatar: true,
                  role: true
                }
              }
            }
          }
        }
      })
    ]);

    return this.createResponse(data, totalItems, page, limit);
  }

  /**
   * Create cursor-based pagination for real-time data
   */
  static async paginateWithCursor<T>(
    prisma: any,
    model: string,
    whereClause: any,
    cursor?: string,
    limit = 20,
    orderBy = { createdAt: 'desc' }
  ): Promise<{
    data: T[];
    nextCursor?: string;
    hasMore: boolean;
  }> {
    const take = limit + 1; // Fetch one extra to check if there are more
    
    const items = await prisma[model].findMany({
      where: whereClause,
      orderBy,
      take,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1 // Skip the cursor item
      })
    });

    const hasMore = items.length > limit;
    const data = hasMore ? items.slice(0, -1) : items;
    const nextCursor = hasMore ? items[items.length - 2].id : undefined;

    return {
      data,
      nextCursor,
      hasMore
    };
  }
}

/**
 * Express middleware to parse pagination parameters
 */
export function paginationMiddleware(req: any, res: any, next: any) {
  const { page, limit, sortBy, sortOrder } = req.query;
  
  req.pagination = PaginationHelper.parseParams({
    page: page ? parseInt(page) : undefined,
    limit: limit ? parseInt(limit) : undefined,
    sortBy,
    sortOrder
  });
  
  next();
}