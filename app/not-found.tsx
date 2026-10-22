import Link from "next/link";
import { buttonCls, EmptyState } from "@/components/ui";

export default function NotFound() {
  return (
    <EmptyState
      title="Not found"
      body="That page or record doesn't exist. It may have been deleted."
      action={
        <Link href="/" className={buttonCls("secondary")}>
          Go home
        </Link>
      }
    />
  );
}
