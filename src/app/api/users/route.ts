import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertSupervisor } from "@/lib/guards";
import { handleApiError } from "@/lib/api-response";

const createSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi"),
  email: z.string().trim().toLowerCase().email("Format email tidak valid"),
  role: z.nativeEnum(Role, { message: "Role harus STAFF atau SUPERVISOR" }),
  password: z.string().min(8, "Kata sandi minimal 8 karakter"),
});

/** POST /api/users — tambah pengguna baru (SUPERVISOR). */
export async function POST(req: Request) {
  try {
    const session = await assertSupervisor();
    const body = createSchema.parse(await req.json());

    const existing = await prisma.user.findUnique({
      where: { email: body.email },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Email sudah terdaftar. Gunakan email lain." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        role: body.role,
        passwordHash,
      },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });

    // Kata sandi tidak pernah dicatat di audit trail.
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE_USER",
        entity: "User",
        entityId: user.id,
        newData: { name: user.name, email: user.email, role: user.role },
      },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
