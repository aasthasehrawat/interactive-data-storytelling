import React, { useEffect, useMemo, useState } from "react";
import ChartPanel from "./ChartPanel";

function toggleValue(list, value) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export default function Reader({
  story,
  data,
  dataset,
  user,
  onBack,
  onEdit,
  onToggleBookmark,
}) {
  const [chapterIndex, setChapterIndex] = useState(0);
  const [focusOverride, setFocusOverride] = useState(null);

  useEffect(() => {
    setChapterIndex(0);
    setFocusOverride(null);
  }, [story?.id]);

  const chapter = story?.chapters?.[chapterIndex];
  const chart = chapter?.chart || { mode: "line", focus_countries: [], year: null };
  const focusCountries = focusOverride ?? chart.focus_countries ?? [];

  const progress = useMemo(() => {
    if (!story?.chapters?.length) return 0;
    return Math.round(((chapterIndex + 1) / story.chapters.length) * 100);
  }, [story, chapterIndex]);

  if (!story || !chapter) {
    return (
      <div className="reader-page">
        <button type="button" onClick={onBack}>
          ← Back to library
        </button>
        <div className="empty-state">
          <h2>Story not found</h2>
        </div>
      </div>
    );
  }

  const canEdit = story.author_id === user.id;

  return (
    <div className="reader-page">
      <div className="reader-nav">
        <button type="button" onClick={onBack}>
          ← Library
        </button>
        <div className="reader-nav-actions">
          <button
            type="button"
            className={story.bookmarked ? "icon-btn active" : "icon-btn"}
            onClick={() => onToggleBookmark(story)}
          >
            {story.bookmarked ? "★ Bookmarked" : "☆ Bookmark"}
          </button>
          {canEdit && (
            <button type="button" onClick={() => onEdit(story)}>
              Edit story
            </button>
          )}
        </div>
      </div>

      <div className="reader-shell">
        <aside className="chapter-rail">
          <p className="eyebrow">Chapters</p>
          <h2>{story.title}</h2>
          <div className="progress-track" aria-hidden="true">
            <span style={{ width: `${progress}%` }} />
          </div>
          <ol>
            {story.chapters.map((item, index) => (
              <li key={item.id || index}>
                <button
                  type="button"
                  className={index === chapterIndex ? "active" : ""}
                  onClick={() => {
                    setChapterIndex(index);
                    setFocusOverride(null);
                  }}
                >
                  <span>{index + 1}</span>
                  <strong>{item.title}</strong>
                </button>
              </li>
            ))}
          </ol>
        </aside>

        <section className="chapter-copy">
          <p className="meta">
            by {story.author_name} · Chapter {chapterIndex + 1} of {story.chapters.length}
          </p>
          <h1>{chapter.title}</h1>
          <p className="story-body">{chapter.body}</p>
          <div className="chapter-controls">
            <button
              type="button"
              disabled={chapterIndex === 0}
              onClick={() => {
                setChapterIndex((value) => Math.max(0, value - 1));
                setFocusOverride(null);
              }}
            >
              Previous
            </button>
            <button
              type="button"
              className="primary"
              disabled={chapterIndex >= story.chapters.length - 1}
              onClick={() => {
                setChapterIndex((value) => Math.min(story.chapters.length - 1, value + 1));
                setFocusOverride(null);
              }}
            >
              Next chapter
            </button>
          </div>
        </section>

        <section className="chapter-visual">
          <div className="visual-header">
            <div>
              <p className="eyebrow">Live chart</p>
              <h2>{dataset?.title || "Dataset"}</h2>
              <p className="meta">
                {chart.mode === "bars"
                  ? `Bar snapshot for ${chart.year || "latest year"}`
                  : "Trend lines over time"}
                {focusCountries.length
                  ? ` · focusing ${focusCountries.join(", ")}`
                  : " · showing all countries"}
              </p>
            </div>
          </div>
          <ChartPanel
            data={data}
            dataset={dataset}
            mode={chart.mode}
            year={chart.year}
            focusCountries={focusCountries}
            onToggleCountry={(country) =>
              setFocusOverride((prev) => toggleValue(prev ?? chart.focus_countries ?? [], country))
            }
          />
          <p className="chart-hint">
            Tip: click a country to focus. Move through chapters to watch the chart change with the
            narrative.
          </p>
        </section>
      </div>
    </div>
  );
}
