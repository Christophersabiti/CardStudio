import type { CardRecord } from "../types";
import { PrintError, printSnapshot, type PrintPreset } from "./policy";

export interface PrintDependencies {
  ownedRecord: (slug: string, ownerId: string) => Promise<CardRecord | null>;
  allowed: (ownerId: string) => Promise<boolean>;
  render: (snapshot: ReturnType<typeof printSnapshot>, preset: PrintPreset, ownerId: string) => Promise<Uint8Array>;
}
export class PrintPlanRequired extends PrintError {
  constructor() { super("Print packages are included with Basic and Premium. Upgrade to download.",403); }
}
/** ownerId must come from the verified application session, never the request body. */
export async function createPrintPackage(ownerId: string, slug: string, revision: number, preset: PrintPreset, siteUrl: string | undefined, deps: PrintDependencies) {
  const record = await deps.ownedRecord(slug,ownerId);
  if(!record) throw new PrintError("Card not found.",404);
  if(!(await deps.allowed(ownerId))) throw new PrintPlanRequired();
  const snapshot = printSnapshot(record,revision,siteUrl);
  const zip = await deps.render(snapshot,preset,ownerId);
  const current = await deps.ownedRecord(slug,ownerId);
  if(!current) throw new PrintError("Card not found.",404);
  printSnapshot(current,revision,siteUrl);
  if(!(await deps.allowed(ownerId))) throw new PrintPlanRequired();
  return {zip,mode:snapshot.mode};
}
