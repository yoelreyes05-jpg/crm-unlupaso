import { redirect } from "next/navigation";

// Redirige automáticamente al POS
export default function Home() {
  redirect("/pos");
}
