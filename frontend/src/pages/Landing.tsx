import { useAuth } from "@workos-inc/authkit-react";
import { saveReturnPath } from "../authReturn";

export function Landing() {
  const { signIn } = useAuth();
  return (
    <div className="landing">
      <div className="landing-card">
        <h1>My App</h1>
        <p className="subtitle">Sign in to continue.</p>
        <button
          className="btn-primary"
          onClick={() => {
            saveReturnPath();
            signIn();
          }}
        >
          Sign in
        </button>
      </div>
    </div>
  );
}
