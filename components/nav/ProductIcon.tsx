import type { ProductKey } from "@/lib/navigation";
import { CardIcon, MailIcon, PrinterIcon, QrIcon, StampIcon, UsersIcon } from "@/components/icons";

const icons = { card: CardIcon, qr: QrIcon, group: UsersIcon, signature: MailIcon, stamp: StampIcon, print: PrinterIcon };

export default function ProductIcon({ product }: { product: ProductKey }) {
  const Icon = icons[product];
  return (
    <span className={`sn-picon sn-picon-${product}`} aria-hidden>
      <Icon width="18" height="18" />
    </span>
  );
}
