import React, { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";

const COLORS = {
  India: "#0f766e",
  USA: "#c2410c",
  China: "#1d4ed8",
  Brazil: "#15803d",
  Nigeria: "#a16207",
  Japan: "#0e7490",
};

function colorFor(country, index) {
  return COLORS[country] || ["#0f766e", "#c2410c", "#1d4ed8", "#15803d", "#a16207", "#0e7490"][index % 6];
}

export default function ChartPanel({
  data,
  dataset,
  mode = "line",
  focusCountries = [],
  year,
  onToggleCountry,
}) {
  const svgRef = useRef(null);
  const [hover, setHover] = useState(null);
  const countries = useMemo(
    () => dataset?.countries || Array.from(new Set(data.map((d) => d.country))),
    [dataset, data]
  );
  const activeSet = useMemo(() => new Set(focusCountries || []), [focusCountries]);
  const metricLabel = dataset?.metric_label || "Value";
  const unit = dataset?.unit || "";

  useEffect(() => setHover(null), [data, mode, focusCountries, year]);

  useEffect(() => {
    const node = svgRef.current;
    if (!node) return;
    const svg = d3.select(node);
    svg.selectAll("*").remove();
    if (!data.length) return;

    const width = 680;
    const height = 340;
    const margin = { top: 18, right: 18, bottom: 46, left: 54 };
    svg.attr("viewBox", [0, 0, width, height]);

    const plot = svg.append("g");

    if (mode === "bars") {
      const targetYear = year || d3.max(data, (d) => d.year);
      const rows = countries
        .map((country) => data.find((d) => d.country === country && d.year === targetYear))
        .filter(Boolean)
        .sort((a, b) => b.value - a.value);

      const x = d3
        .scaleBand()
        .domain(rows.map((d) => d.country))
        .range([margin.left, width - margin.right])
        .padding(0.28);
      const y = d3
        .scaleLinear()
        .domain([0, Math.max(d3.max(rows, (d) => d.value) * 1.12, 1)])
        .range([height - margin.bottom, margin.top]);

      plot
        .append("g")
        .attr("transform", `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(x));
      plot
        .append("g")
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(y).ticks(5));

      plot
        .selectAll("rect")
        .data(rows)
        .join("rect")
        .attr("x", (d) => x(d.country))
        .attr("y", (d) => y(d.value))
        .attr("width", x.bandwidth())
        .attr("height", (d) => y(0) - y(d.value))
        .attr("rx", 8)
        .attr("fill", (d, i) => colorFor(d.country, i))
        .attr("opacity", (d) => (activeSet.size && !activeSet.has(d.country) ? 0.22 : 1))
        .on("mousemove", (event, d) => {
          setHover({
            x: event.clientX,
            y: event.clientY,
            label: `${d.country} · ${d.year}`,
            value: `${d.value}${unit}`,
          });
        })
        .on("mouseleave", () => setHover(null));

      plot
        .append("text")
        .attr("class", "axis-label")
        .attr("x", (margin.left + width - margin.right) / 2)
        .attr("y", height - 8)
        .attr("text-anchor", "middle")
        .text(`Share of people online in ${targetYear}`);
    } else {
      const grouped = countries.map((country) => ({
        country,
        points: data
          .filter((d) => d.country === country)
          .slice()
          .sort((a, b) => a.year - b.year),
      }));
      const years = Array.from(new Set(data.map((d) => d.year))).sort((a, b) => a - b);
      const maxValue = d3.max(data, (d) => d.value) || 0;
      const x = d3
        .scaleLinear()
        .domain(d3.extent(years))
        .range([margin.left, width - margin.right]);
      const y = d3
        .scaleLinear()
        .domain([0, Math.max(maxValue * 1.08, 1)])
        .range([height - margin.bottom, margin.top]);
      const line = d3
        .line()
        .x((d) => x(d.year))
        .y((d) => y(d.value))
        .curve(d3.curveMonotoneX);

      plot
        .append("g")
        .attr("transform", `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(x).tickValues(years).tickFormat(d3.format("d")));
      plot
        .append("g")
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(y).ticks(5));

      grouped.forEach((series, index) => {
        const dimmed = activeSet.size > 0 && !activeSet.has(series.country);
        const color = colorFor(series.country, index);
        plot
          .append("path")
          .datum(series.points)
          .attr("fill", "none")
          .attr("stroke", color)
          .attr("stroke-width", dimmed ? 1.5 : 2.8)
          .attr("opacity", dimmed ? 0.16 : 1)
          .attr("d", line);
        plot
          .append("g")
          .selectAll("circle")
          .data(series.points)
          .join("circle")
          .attr("cx", (d) => x(d.year))
          .attr("cy", (d) => y(d.value))
          .attr("r", dimmed ? 2.8 : 4.4)
          .attr("fill", color)
          .attr("opacity", dimmed ? 0.2 : 1)
          .on("mousemove", (event, d) => {
            setHover({
              x: event.clientX,
              y: event.clientY,
              label: `${d.country} · ${d.year}`,
              value: `${d.value}${unit}`,
            });
          })
          .on("mouseleave", () => setHover(null));
      });

      plot
        .append("text")
        .attr("class", "axis-label")
        .attr("x", (margin.left + width - margin.right) / 2)
        .attr("y", height - 8)
        .attr("text-anchor", "middle")
        .text("Year");
    }

    plot
      .append("text")
      .attr("class", "axis-label")
      .attr("transform", "rotate(-90)")
      .attr("x", -(margin.top + height - margin.bottom) / 2)
      .attr("y", 14)
      .attr("text-anchor", "middle")
      .text(metricLabel);
  }, [data, mode, year, activeSet, countries, metricLabel, unit]);

  return (
    <div className="chart-panel">
      <svg ref={svgRef} role="img" aria-label={metricLabel} />
      <div className="legend">
        {countries.map((country, index) => {
          const pressed = activeSet.has(country);
          return (
            <button
              key={country}
              type="button"
              className={pressed ? "active" : ""}
              aria-pressed={pressed}
              onClick={() => onToggleCountry?.(country)}
            >
              <span className="swatch" style={{ background: colorFor(country, index) }} />
              {country}
            </button>
          );
        })}
      </div>
      {hover && (
        <div className="tooltip" style={{ left: hover.x, top: hover.y }}>
          <strong>{hover.label}</strong>
          <div>{hover.value}</div>
        </div>
      )}
    </div>
  );
}
