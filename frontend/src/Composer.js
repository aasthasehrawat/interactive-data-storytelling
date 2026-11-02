import React, { useState } from "react";
import { api } from "./api";

function blankChapter() {
  return {
    title: "",
    body: "",
    chart: { mode: "line", focus_countries: [], year: null },
  };
}

export default function Composer({ dataset, initialStory, onCancel, onSaved }) {
  const editing = Boolean(initialStory?.id);
  const [title, setTitle] = useState(initialStory?.title || "");
  const [summary, setSummary] = useState(initialStory?.summary || "");
  const [tags, setTags] = useState((initialStory?.tags || []).join(", "));
  const [chapters, setChapters] = useState(
    initialStory?.chapters?.length
      ? initialStory.chapters.map((chapter) => ({
          title: chapter.title,
          body: chapter.body,
          chart: {
            mode: chapter.chart?.mode || "line",
            focus_countries: chapter.chart?.focus_countries || [],
            year: chapter.chart?.year || dataset?.years?.[dataset.years.length - 1] || null,
          },
        }))
      : [blankChapter()]
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const countries = dataset?.countries || [];
  const years = dataset?.years || [];

  const updateChapter = (index, patch) => {
    setChapters((prev) => prev.map((chapter, i) => (i === index ? { ...chapter, ...patch } : chapter)));
  };

  const updateChart = (index, patch) => {
    setChapters((prev) =>
      prev.map((chapter, i) =>
        i === index ? { ...chapter, chart: { ...chapter.chart, ...patch } } : chapter
      )
    );
  };

  const toggleFocus = (index, country) => {
    const current = chapters[index].chart.focus_countries || [];
    const next = current.includes(country)
      ? current.filter((item) => item !== country)
      : [...current, country];
    updateChart(index, { focus_countries: next });
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        title: title.trim(),
        summary: summary.trim(),
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        chapters: chapters.map((chapter) => ({
          title: chapter.title.trim(),
          body: chapter.body.trim(),
          chart: {
            mode: chapter.chart.mode,
            focus_countries: chapter.chart.focus_countries,
            year: chapter.chart.mode === "bars" ? chapter.chart.year : null,
          },
        })),
      };
      const saved = await api(editing ? `/api/stories/${initialStory.id}` : "/api/stories", {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      onSaved(saved);
    } catch (err) {
      setError(err.message || "Could not save the story.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="composer">
      <header className="topbar">
        <div>
          <p className="brand-mark">Story composer</p>
          <h1>{editing ? "Edit your story" : "Write a guided story"}</h1>
          <p className="lede compact">
            Each chapter can change the chart mode, year, and highlighted countries — that is how
            readers learn from the data.
          </p>
        </div>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </header>

      <form className="composer-form" onSubmit={save}>
        <label>
          Title
          <input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={160} />
        </label>
        <label>
          Summary
          <textarea
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            rows={2}
            maxLength={280}
            placeholder="One or two sentences for the library card"
          />
        </label>
        <label>
          Tags
          <input
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="growth, kids, overview"
          />
        </label>

        {chapters.map((chapter, index) => (
          <fieldset key={index} className="chapter-editor">
            <legend>Chapter {index + 1}</legend>
            <label>
              Chapter title
              <input
                value={chapter.title}
                onChange={(event) => updateChapter(index, { title: event.target.value })}
                required
              />
            </label>
            <label>
              Chapter body
              <textarea
                value={chapter.body}
                onChange={(event) => updateChapter(index, { body: event.target.value })}
                rows={5}
                required
              />
            </label>
            <div className="composer-chart-controls">
              <label>
                Chart mode
                <select
                  value={chapter.chart.mode}
                  onChange={(event) => updateChart(index, { mode: event.target.value })}
                >
                  <option value="line">Trend lines</option>
                  <option value="bars">Year ranking bars</option>
                </select>
              </label>
              {chapter.chart.mode === "bars" && (
                <label>
                  Year
                  <select
                    value={chapter.chart.year || years[years.length - 1]}
                    onChange={(event) => updateChart(index, { year: Number(event.target.value) })}
                  >
                    {years.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <div>
              <p className="meta">Highlight countries for this chapter</p>
              <div className="chip-row">
                {countries.map((country) => (
                  <button
                    key={country}
                    type="button"
                    className={chapter.chart.focus_countries.includes(country) ? "active" : ""}
                    onClick={() => toggleFocus(index, country)}
                  >
                    {country}
                  </button>
                ))}
              </div>
            </div>
            {chapters.length > 1 && (
              <button
                type="button"
                onClick={() => setChapters((prev) => prev.filter((_, i) => i !== index))}
              >
                Remove chapter
              </button>
            )}
          </fieldset>
        ))}

        <div className="form-actions">
          <button
            type="button"
            onClick={() => setChapters((prev) => [...prev, blankChapter()])}
            disabled={chapters.length >= 8}
          >
            Add chapter
          </button>
          <button className="primary" type="submit" disabled={saving}>
            {saving ? "Saving…" : editing ? "Update story" : "Publish story"}
          </button>
        </div>
        {error && <p className="form-error">{error}</p>}
      </form>
    </div>
  );
}
