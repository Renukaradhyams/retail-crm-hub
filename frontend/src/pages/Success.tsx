import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";

export function Success() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="panel max-w-md p-8 text-center">
        <CheckCircle2 className="mx-auto h-16 w-16 text-success" />
        <h1 className="mt-4 font-display text-2xl font-bold">Thank You!</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your feedback has been received and shared directly with the store manager. Have a great day!
        </p>
        <div className="mt-6">
          <Link
            to="/feedback-public"
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Submit Another Feedback
          </Link>
        </div>
      </div>
    </div>
  );
}
