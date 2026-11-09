import type { Session } from 'next-auth';
import { prisma } from './prisma';

/**
 * Devuelve la sucursal con la que trabaja el usuario.
 * Si el usuario no tiene sucursal asignada (p. ej. el ADMIN general),
 * se usa la primera sucursal registrada, igual que en el resto del sistema.
 */
export async function resolveBranchId(session: Session): Promise<string | undefined> {
  const branchId = (session.user as any)?.branchId as string | null | undefined;
  if (branchId) return branchId;
  const firstBranch = await prisma.branch.findFirst({ orderBy: { createdAt: 'asc' } });
  return firstBranch?.id;
}

export function hasRole(session: Session | null, roles: string[]): boolean {
  return !!session && roles.includes((session.user as any)?.role);
}

/** Folio con sufijo aleatorio para evitar choques con la restricción @unique. */
export function makeFolio(prefix: string): string {
  const time = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${time}${rand}`;
}

/** Error de negocio: se responde con 400 en lugar de 500. */
export class BusinessError extends Error {}
