import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertSupervisor } from "@/lib/guards";
import { handleApiError } from "@/lib/api-response";

const patchSchema = z.object({
  isActive: z.boolean({ message: "Status aktif wajib berupa boolean" }),
});

/** PATCH /api/users/:id — aktifkan / nonaktifkan akun pengguna (SUPERVISOR). */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await assertSupervisor();
    const body = patchSchema.parse(await req.json());

    if (params.id === session.user.id && !body.isActive) {
      return NextResponse.json(
        { error: "Anda tidak dapat menonaktifkan akun sendiri." },
        { status: 409 }
      );
    }

    const current = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, name: true, isActive: true },
    });
    if (!current) {
      return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });
    }

    const updated = await prisma.user.update({
      where: { id: params.id },
      data: { isActive: body.isActive },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE_USER_STATUS",
        entity: "User",
        entityId: params.id,
        oldData: { name: current.name, isActive: current.isActive },
        newData: { name: current.name, isActive: updated.isActive },
      },
    });

    return NextResponse.json({ user: updated });
  } catch (e) {
    return handleApiError(e);
  }
}
