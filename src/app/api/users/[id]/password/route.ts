import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { assertSupervisor } from "@/lib/guards";
import { handleApiError } from "@/lib/api-response";

const bodySchema = z.object({
  password: z.string().min(8, "Kata sandi minimal 8 karakter"),
});

/** POST /api/users/:id/password — reset kata sandi pengguna (SUPERVISOR). */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await assertSupervisor();
    const body = bodySchema.parse(await req.json());

    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, name: true },
    });
    if (!user) {
      return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
    await prisma.user.update({ where: { id: params.id }, data: { passwordHash } });

    // Kata sandi tidak pernah dicatat di audit trail.
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "RESET_USER_PASSWORD",
        entity: "User",
        entityId: params.id,
        newData: { name: user.name, passwordReset: true },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
