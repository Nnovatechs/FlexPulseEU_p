import { timingSafeEqual } from "crypto";
import { getInternalJobSecret } from "./internal-jobs-env";

function readProvidedSecret(request: Request) {
  return (
    request.headers.get("x-internal-job-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    ""
  );
}

export function isInternalJobRequestAuthorized(request: Request) {
  const expected = getInternalJobSecret();
  const provided = readProvidedSecret(request);

  if (!expected || !provided) {
    return false;
  }

  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);

  return (
    expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer)
  );
}
