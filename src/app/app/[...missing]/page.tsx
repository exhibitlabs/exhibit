import { notFound } from "next/navigation";

/** Unknown /app/* paths render the app's own not-found page, inside the app shell. */
export default function Missing() {
  notFound();
}
