import Header from "@/components/Header";
import Studio from "@/components/Studio";
import { activeBrand } from "@/lib/brand";

export default function Home() {
  return (
    <>
      <Header brand={activeBrand} />
      <Studio brand={activeBrand} />
    </>
  );
}
