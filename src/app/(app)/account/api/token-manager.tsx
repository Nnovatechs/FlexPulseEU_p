"use client";

import { useActionState, useState } from "react";
import {
  createApiTokenAction,
  type CreateApiTokenActionState,
  revokeApiTokenAction,
} from "@/features/interoperability/api-token-actions";
import { datetimeLocalToIso } from "@/features/interoperability/api-token-expiry";
import type { InteroperabilityApiTokenSummary } from "@/features/interoperability/api-types";

export const DATA_READ_SCOPE_WARNING =
  "`data:read` exports respondent-level answers (including free text) and mapped profiles. Treat this as personal data under your DPA. Keep the token on your backend only.";

type TokenManagerProps = {
  tokens: InteroperabilityApiTokenSummary[];
};

const INITIAL_CREATE_API_TOKEN_STATE: CreateApiTokenActionState = {
  status: "idle",
  message: null,
  token: null,
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "Never";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(parsed);
}

function readLocalExpiryIso(form: HTMLFormElement) {
  const localInput = form.elements.namedItem("expiresAtLocal");
  if (!(localInput instanceof HTMLInputElement) || !localInput.value) {
    return "";
  }
  return datetimeLocalToIso(localInput.value);
}

export function TokenManager({ tokens }: TokenManagerProps) {
  const [state, formAction, pending] = useActionState(
    createApiTokenAction,
    INITIAL_CREATE_API_TOKEN_STATE,
  );
  const [dismissedToken, setDismissedToken] = useState<string | null>(null);
  const [includeDataRead, setIncludeDataRead] = useState(false);
  const revealedToken = state.token && state.token !== dismissedToken ? state.token : null;

  async function handleCopy() {
    if (!revealedToken) {
      return;
    }
    await navigator.clipboard.writeText(revealedToken);
    setDismissedToken(revealedToken);
  }

  return (
    <div className="page-stack">
      <section className="surface-card stack-form">
        <div>
          <p className="legal-eyebrow">Server-to-server access</p>
          <h2>Create API token</h2>
          <p className="muted">
            Use API tokens from your own backend, scripts or notebooks. Do not embed them in
            browser JavaScript.
          </p>
        </div>

        <div className="notice notice--warning">This token will only be shown once.</div>

        <form
          action={formAction}
          className="stack-form"
          onSubmit={(event) => {
            const form = event.currentTarget;
            const hidden = form.elements.namedItem("expiresAt");
            if (hidden instanceof HTMLInputElement) {
              hidden.value = readLocalExpiryIso(form);
            }
          }}
        >
          <label className="field">
            <span>Token name</span>
            <input
              name="name"
              placeholder="Production sync"
              maxLength={80}
              required
              onInvalid={(event) => {
                event.currentTarget.setCustomValidity("Please fill out this field.");
              }}
              onInput={(event) => {
                event.currentTarget.setCustomValidity("");
              }}
            />
          </label>

          <label className="field">
            <span>Expires at (optional, your local time)</span>
            <input name="expiresAtLocal" type="datetime-local" />
            <input type="hidden" name="expiresAt" />
          </label>

          <fieldset className="field">
            <legend>Scopes</legend>
            <label className="checkbox-field">
              <input type="checkbox" name="scopes" value="surveys:read" defaultChecked />
              <span>`surveys:read` — survey metadata and schema</span>
            </label>
            <label className="checkbox-field">
              <input type="checkbox" name="scopes" value="analytics:read" defaultChecked />
              <span>`analytics:read` — aggregated analytics queries</span>
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                name="scopes"
                value="data:read"
                checked={includeDataRead}
                onChange={(event) => setIncludeDataRead(event.currentTarget.checked)}
              />
              <span>`data:read` — respondent answers and mapped profiles</span>
            </label>
            {includeDataRead ? (
              <div className="notice notice--warning" role="status">
                {DATA_READ_SCOPE_WARNING}
              </div>
            ) : (
              <p className="muted">Off by default. Enable only if your backend needs raw exports.</p>
            )}
          </fieldset>

          {state.message ? (
            <div
              className={`notice ${state.status === "error" ? "notice--error" : "notice--info"}`}
              role={state.status === "error" ? "alert" : "status"}
            >
              {state.message}
            </div>
          ) : null}

          {revealedToken ? (
            <div className="stack-form">
              <label className="field">
                <span>Token</span>
                <textarea readOnly rows={3} value={revealedToken} />
              </label>
              <div className="privacy-settings__actions">
                <button type="button" className="button button--ghost" onClick={handleCopy}>
                  Copy
                </button>
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => setDismissedToken(revealedToken)}
                >
                  Close
                </button>
              </div>
            </div>
          ) : null}

          <div className="privacy-settings__actions">
            <button type="submit" className="button button--primary" disabled={pending}>
              {pending ? "Creating token..." : "Create token"}
            </button>
          </div>
        </form>
      </section>

      <section className="surface-card stack-form">
        <div>
          <p className="legal-eyebrow">Existing tokens</p>
          <h2>Active and revoked tokens</h2>
        </div>

        {tokens.length === 0 ? <p className="muted">No API tokens created yet.</p> : null}

        {tokens.map((token) => (
          <article key={token.id} className="interoperability-token-row">
            <div className="interoperability-token-row__main">
              <div className="interoperability-token-row__identity">
                <h3>{token.name}</h3>
                <p className="muted">
                  {token.tokenPrefix} · {token.status}
                </p>
              </div>

              <div className="interoperability-token-row__meta muted">
                <span>Scopes: {token.scopes.join(", ")}</span>
                <span>Created: {formatDateTime(token.createdAt)}</span>
                <span>Expires: {formatDateTime(token.expiresAt)}</span>
                <span>Last used: {formatDateTime(token.lastUsedAt)}</span>
              </div>
            </div>

            <div className="interoperability-token-row__actions">
              {token.status === "active" ? (
                <form
                  action={revokeApiTokenAction}
                  onSubmit={(event) => {
                    if (!window.confirm("Revoke this token? This cannot be undone.")) {
                      event.preventDefault();
                    }
                  }}
                >
                  <input type="hidden" name="tokenId" value={token.id} />
                  <button type="submit" className="button button--ghost">
                    Revoke token
                  </button>
                </form>
              ) : null}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
