import Link from "next/link";
export default function NotFound() {
  return <main className="max-w-lg mx-auto p-8"><h1 className="text-2xl mb-4">This card isn’t available</h1><p className="mb-4">It may be private, unpublished, or removed. Ask the owner for a current link.</p><Link className="cs-button" href="/">Go to Card Studio</Link></main>;
}
