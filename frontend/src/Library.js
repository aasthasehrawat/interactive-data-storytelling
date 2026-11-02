import React, { useMemo, useState } from "react";

function readingMinutes(story) {
  const words = (story.chapters || []).reduce(
    (total, chapter) => total + String(chapter.body || "").split(/\s+/).filter(Boolean).length,
    0
  );
  return Math.max(1, Math.round(words / 140));
}

export default function Library({
  user,
  dataset,
  stories,
  connection,
  onOpenStory,
  onWrite,
  onToggleBookmark,
  onLogout,
}) {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("all");
  const [onlyBookmarks, setOnlyBookmarks] = useState(false);

  const tags = useMemo(() => {
    const set = new Set();
    stories.forEach((story) => (story.tags || []).forEach((item) => set.add(item)));
    return ["all", ...Array.from(set)];
  }, [stories]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return stories.filter((story) => {
      if (onlyBookmarks && !story.bookmarked) return false;
      if (tag !== "all" && !(story.tags || []).includes(tag)) return false;
      if (!needle) return true;
      const hay = `${story.title} ${story.summary} ${story.author_name} ${(story.tags || []).join(" ")}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [stories, query, tag, onlyBookmarks]);

  const featured = filtered.filter((story) => story.featured);
  const rest = filtered.filter((story) => !story.featured);

  return (
    <div className="library">
      <header className="topbar">
        <div>
          <p className="brand-mark">Interactive Data Storytelling Hub</p>
          <h1>Story library</h1>
          <p className="lede compact">
            Welcome, {user.name}. Open a story to read chapter by chapter — the chart updates with
            every step.
          </p>
        </div>
        <div className="topbar-actions">
          <span className={`live-pill ${connection}`}>
            {connection === "live" ? "Live" : connection === "reconnecting" ? "Reconnecting" : "Connecting"}
          </span>
          <button type="button" className="primary" onClick={onWrite}>
            Write a story
          </button>
          <button type="button" onClick={onLogout}>
            Log out
          </button>
        </div>
      </header>

      {dataset && (
        <section className="dataset-banner">
          <div>
            <p className="eyebrow">Active dataset</p>
            <h2>{dataset.title}</h2>
            <p>{dataset.subtitle}</p>
            <p className="meta">{dataset.source}</p>
          </div>
          <div className="insight-grid">
            <article>
              <span>Fastest climb</span>
              <strong>
                {dataset.insights?.fastest_climber
                  ? `${dataset.insights.fastest_climber.country} +${dataset.insights.fastest_climber.gain} pts`
                  : "—"}
              </strong>
            </article>
            <article>
              <span>Highest access</span>
              <strong>
                {dataset.insights?.highest_access
                  ? `${dataset.insights.highest_access.country} ${dataset.insights.highest_access.value}%`
                  : "—"}
              </strong>
            </article>
            <article>
              <span>Latest gap</span>
              <strong>{dataset.insights ? `${dataset.insights.latest_gap} pts` : "—"}</strong>
            </article>
          </div>
        </section>
      )}

      <div className="library-toolbar">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search titles, tags, authors…"
          aria-label="Search stories"
        />
        <div className="chip-row">
          {tags.map((item) => (
            <button
              key={item}
              type="button"
              className={tag === item ? "active" : ""}
              onClick={() => setTag(item)}
            >
              {item}
            </button>
          ))}
          <button
            type="button"
            className={onlyBookmarks ? "active" : ""}
            onClick={() => setOnlyBookmarks((value) => !value)}
          >
            Bookmarks
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <h2>No stories match</h2>
          <p>Try another tag, clear search, or write the first chaptered story.</p>
        </div>
      ) : (
        <>
          {featured.length > 0 && (
            <section className="story-section">
              <h2>Featured</h2>
              <div className="story-grid featured-grid">
                {featured.map((story) => (
                  <StoryCard
                    key={story.id}
                    story={story}
                    minutes={readingMinutes(story)}
                    onOpen={() => onOpenStory(story.id)}
                    onToggleBookmark={() => onToggleBookmark(story)}
                  />
                ))}
              </div>
            </section>
          )}
          {rest.length > 0 && (
            <section className="story-section">
              <h2>{featured.length ? "More stories" : "All stories"}</h2>
              <div className="story-grid">
                {rest.map((story) => (
                  <StoryCard
                    key={story.id}
                    story={story}
                    minutes={readingMinutes(story)}
                    onOpen={() => onOpenStory(story.id)}
                    onToggleBookmark={() => onToggleBookmark(story)}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function StoryCard({ story, minutes, onOpen, onToggleBookmark }) {
  return (
    <article className="story-card">
      <div className="story-card-top">
        <div className="tag-row">
          {(story.tags || []).slice(0, 3).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
        <button
          type="button"
          className={story.bookmarked ? "icon-btn active" : "icon-btn"}
          aria-label={story.bookmarked ? "Remove bookmark" : "Bookmark story"}
          onClick={onToggleBookmark}
        >
          {story.bookmarked ? "★" : "☆"}
        </button>
      </div>
      <h3>{story.title}</h3>
      <p>{story.summary || "Open the story to explore its chapters and charts."}</p>
      <div className="story-card-meta">
        <span>{story.author_name}</span>
        <span>{story.chapters?.length || 0} chapters</span>
        <span>{minutes} min</span>
      </div>
      <button type="button" className="primary" onClick={onOpen}>
        Read with charts
      </button>
    </article>
  );
}
