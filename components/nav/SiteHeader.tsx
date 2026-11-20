import { activeBrand } from "@/lib/brand";
import { isClerkConfigured } from "@/lib/auth/config";
import NavBar from "./NavBar";
import "./nav.css";

/** The one site header, shared by marketing pages and the signed-in app. */
export default function SiteHeader() {
  const brand = activeBrand;
  return (
    <NavBar
      authEnabled={isClerkConfigured()}
      brand={{ key: brand.key, name: brand.name, logo: brand.logo, initial: brand.name[0] || "C" }}
    />
  );
}
