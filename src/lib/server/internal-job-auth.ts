import { timingSafeEqual } from "crypto";
import { getInternalJobSecrets } from "./internal-jobs-env";

function readProvidedSecret(request: Request) {
  return (
    request.headers.get("x-internal-job-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    ""
  );
}

export function isInternalJobRequestAuthorized(request: Request) {
  const expectedSecrets = getInternalJobSecrets();
  const provided = readProvidedSecret(request);

  if (!provided) {
    return false;
  }

  const providedBuffer = Buffer.from(provided);

  return expectedSecrets.some((expected) => {
    const expectedBuffer = Buffer.from(expected);

    return (
      expectedBuffer.length === providedBuffer.length &&
      timingSafeEqual(expectedBuffer, providedBuffer)
    );
  });
}
