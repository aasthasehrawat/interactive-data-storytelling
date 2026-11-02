import React, { useState } from "react";
import { api, saveSession } from "./api";

const HIGHLIGHTS = [
  "Chaptered stories that drive the chart as you read",
  "Trend lines and year snapshots in one narrative",
  "Write your own guided data story after you sign in",
];

export default function AuthPage({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const path = mode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const payload =
        mode === "signup"
          ? { name: name.trim(), email: email.trim(), password }
          : { email: email.trim(), password };
      const result = await api(path, { method: "POST", body: JSON.stringify(payload) });
      saveSession(result.token, result.user);
      onAuth(result.user);
    } catch (err) {
      setError(err.message || "Could not continue.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-shell">
      <section className="auth-stage">
        <p className="brand-mark">Interactive Data Storytelling Hub</p>
        <h1>Stories that teach with charts.</h1>
        <p className="lede">
          Sign in to explore guided narratives about the global digital divide. Each chapter
          updates the visualization so readers understand the numbers while they read.
        </p>
        <ul className="auth-points">
          {HIGHLIGHTS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <div className="auth-preview" aria-hidden="true">
          <div className="preview-card">
            <span>Dataset</span>
            <strong>Global Digital Divide</strong>
            <em>Internet users · 2015–2022 · 6 countries</em>
          </div>
          <div className="preview-card soft">
            <span>Reader mode</span>
            <strong>Chapter → Chart sync</strong>
            <em>Lines for trends · Bars for rankings</em>
          </div>
        </div>
      </section>

      <form className="auth-card" onSubmit={submit}>
        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "login"}
            className={mode === "login" ? "active" : ""}
            onClick={() => {
              setMode("login");
              setError("");
            }}
          >
            Log in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signup"}
            className={mode === "signup" ? "active" : ""}
            onClick={() => {
              setMode("signup");
              setError("");
            }}
          >
            Sign up
          </button>
        </div>

        {mode === "signup" && (
          <label>
            Name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              autoComplete="name"
              required
            />
          </label>
        )}
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 4 characters"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            minLength={4}
            required
          />
        </label>

        {error && <p className="form-error">{error}</p>}

        <button className="primary wide" type="submit" disabled={busy}>
          {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Enter the library"}
        </button>
        <p className="fineprint">
          Demo tip: create any account, then open the featured story “Who got online first?”
        </p>
      </form>
    </div>
  );
}
