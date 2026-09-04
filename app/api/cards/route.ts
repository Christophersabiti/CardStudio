import { NextResponse } from "next/server";
import { createCard } from "@/lib/cards";
import type { CardData } from "@/lib/types";

export const runtime = "nodejs";

// ~400 KB guard: enough for a compressed profile photo stored inline, small
// enough to keep rows sane. Raise this once photos move to Supabase Storage.
const MAX_BYTES = 400_000;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const data = body?.data as CardData | undefined;

    if (!data || typeof data !== "object") {
      return NextResponse.json({ error: "Missing card data." }, { status: 400 });
    }
    if (!data.firstName && !data.lastName && !data.organization) {
      return NextResponse.json(
        { error: "Add a name or organization before saving." },
        { status: 400 }
      );
    }
    if (JSON.stringify(data).length > MAX_BYTES) {
      return NextResponse.json(
        { error: "Card is too large — try a smaller profile photo." },
        { status: 413 }
      );
    }

    const { slug } = await createCard(data);
    return NextResponse.json({ slug }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
