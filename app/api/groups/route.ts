import { NextResponse } from "next/server";
import { createGroup } from "@/lib/groups";
import type { GroupData } from "@/lib/types";

export const runtime = "nodejs";

// Mirrors the single-card guard: plenty for a few hundred lightweight members.
const MAX_BYTES = 400_000;
const MAX_MEMBERS = 500;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const data = body?.data as GroupData | undefined;

    if (!data || typeof data !== "object") {
      return NextResponse.json({ error: "Missing group data." }, { status: 400 });
    }
    if (!data.name.trim()) {
      return NextResponse.json({ error: "Give the group a name before saving." }, { status: 400 });
    }
    if (!Array.isArray(data.members) || data.members.length === 0) {
      return NextResponse.json({ error: "Upload a CSV with at least one person." }, { status: 400 });
    }
    if (data.members.length > MAX_MEMBERS) {
      return NextResponse.json({ error: `A group can have at most ${MAX_MEMBERS} people.` }, { status: 413 });
    }
    if (JSON.stringify(data).length > MAX_BYTES) {
      return NextResponse.json({ error: "Group is too large — try fewer people." }, { status: 413 });
    }

    const { slug } = await createGroup(data);
    return NextResponse.json({ slug }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
