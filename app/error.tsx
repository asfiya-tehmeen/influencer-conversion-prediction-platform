"use client";

import { buttonCls, EmptyState } from "@/components/ui";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <EmptyState
      title="Something went wrong"
      body={error.message || "An unexpected error occurred."}
      action={
        <button onClick={reset} className={buttonCls("secondary")}>
          Try again
        </button>
      }
    />
  );
}
