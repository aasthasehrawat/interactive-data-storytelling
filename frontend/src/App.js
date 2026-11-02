import React, { useCallback, useEffect, useState } from "react";
import AuthPage from "./AuthPage";
import Library from "./Library";
import Reader from "./Reader";
import Composer from "./Composer";
import { api, clearSession, getToken, wsUrl } from "./api";
import "./App.css";

function upsertStory(list, story) {
  const index = list.findIndex((item) => item.id === story.id);
  if (index === -1) return [...list, story];
  const next = list.slice();
  next[index] = story;
  return next;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [view, setView] = useState("library");
  const [dataset, setDataset] = useState(null);
  const [data, setData] = useState([]);
  const [stories, setStories] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [editingStory, setEditingStory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [connection, setConnection] = useState("connecting");
  const [reloadKey, setReloadKey] = useState(0);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
    setView("library");
    setSelectedId(null);
    setEditingStory(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      if (!getToken()) {
        if (!cancelled) {
          setUser(null);
          setChecking(false);
        }
        return;
      }
      try {
        const result = await api("/api/auth/me");
        if (!cancelled) setUser(result.user);
      } catch (err) {
        clearSession();
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setChecking(false);
      }
    };
    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    const pending = [];
    let ready = false;
    let everOpened = false;
    let socket;
    let retryTimer;

    const applyStory = (story) => {
      if (!story || typeof story.id !== "number") return;
      setStories((prev) => upsertStory(prev, story));
    };

    const load = async () => {
      setLoading(true);
      try {
        const [datasetJson, dataJson, storiesJson] = await Promise.all([
          api("/api/dataset"),
          api("/api/data"),
          api("/api/stories"),
        ]);
        if (cancelled) return;
        setDataset(datasetJson);
        setData(dataJson);
        setStories(storiesJson);
        setLoadError("");
      } catch (err) {
        if (!cancelled) {
          if (err.status === 401) {
            logout();
            return;
          }
          setLoadError("Could not load the hub. Is the backend running on port 5000?");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          ready = true;
          pending.splice(0).forEach(applyStory);
        }
      }
    };

    const connect = () => {
      socket = new WebSocket(wsUrl());
      socket.onopen = () => {
        if (cancelled) return;
        setConnection("live");
        if (everOpened) {
          api("/api/stories")
            .then((storiesJson) => {
              if (!cancelled && Array.isArray(storiesJson)) setStories(storiesJson);
            })
            .catch(() => {});
        }
        everOpened = true;
      };
      socket.onmessage = (event) => {
        let message;
        try {
          message = JSON.parse(event.data);
        } catch (err) {
          return;
        }
        if (!message || (message.type !== "story_created" && message.type !== "story_updated")) {
          return;
        }
        if (!ready) pending.push(message.story);
        else applyStory(message.story);
      };
      socket.onerror = () => socket.close();
      socket.onclose = () => {
        if (cancelled) return;
        setConnection("reconnecting");
        retryTimer = setTimeout(connect, 1500);
      };
    };

    load();
    connect();

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      if (socket && socket.readyState < WebSocket.CLOSING) socket.close();
    };
  }, [user, reloadKey, logout]);

  const handleLogout = async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch (err) {
      // Local logout still proceeds.
    }
    logout();
  };

  const toggleBookmark = async (story) => {
    try {
      const result = await api(`/api/bookmarks/${story.id}`, {
        method: story.bookmarked ? "DELETE" : "POST",
      });
      setStories((prev) =>
        prev.map((item) =>
          item.id === story.id ? { ...item, bookmarked: result.bookmarked } : item
        )
      );
    } catch (err) {
      // Keep UI unchanged on failure.
    }
  };

  if (checking) {
    return (
      <div className="boot">
        <p>Opening the hub…</p>
      </div>
    );
  }

  if (!user) {
    return <AuthPage onAuth={setUser} />;
  }

  if (view === "compose") {
    return (
      <Composer
        dataset={dataset}
        initialStory={editingStory}
        onCancel={() => {
          setEditingStory(null);
          setView(selectedId ? "reader" : "library");
        }}
        onSaved={(saved) => {
          setStories((prev) => upsertStory(prev, saved));
          setSelectedId(saved.id);
          setEditingStory(null);
          setView("reader");
        }}
      />
    );
  }

  if (view === "reader") {
    const story = stories.find((item) => item.id === selectedId);
    return (
      <Reader
        story={story}
        data={data}
        dataset={dataset}
        user={user}
        onBack={() => setView("library")}
        onEdit={(current) => {
          setEditingStory(current);
          setView("compose");
        }}
        onToggleBookmark={toggleBookmark}
      />
    );
  }

  return (
    <>
      {loadError && (
        <div className="banner" role="alert">
          <p>{loadError}</p>
          <button
            type="button"
            onClick={() => {
              setReloadKey((key) => key + 1);
            }}
          >
            Retry
          </button>
        </div>
      )}
      {loading && !dataset ? (
        <div className="boot">
          <p>Loading stories and charts…</p>
        </div>
      ) : (
        <Library
          user={user}
          dataset={dataset}
          stories={stories}
          connection={connection}
          onOpenStory={(id) => {
            setSelectedId(id);
            setView("reader");
          }}
          onWrite={() => {
            setEditingStory(null);
            setView("compose");
          }}
          onToggleBookmark={toggleBookmark}
          onLogout={handleLogout}
        />
      )}
    </>
  );
}
