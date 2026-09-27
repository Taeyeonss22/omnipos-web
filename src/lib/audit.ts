import { prisma } from './prisma';

interface AuditLogOptions {
  userId: string;
  branchId?: string;
  action: string;
  entity: string;
  entityId: string;
  details: any;
}

export async function createAuditLog(options: AuditLogOptions) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: options.userId,
        branchId: options.branchId,
        action: options.action,
        entity: options.entity,
        entityId: options.entityId,
        details: JSON.stringify(options.details),
      },
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
  }
}
