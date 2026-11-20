/**
 * CNS5-Audit — Pure Client-Side SVG Visualization Module
 *
 * Exports:
 *   - renderRadarChart(containerEl, domainScores, options)
 *   - renderDecisionTrace(containerEl, cns5Result, options)
 *   - renderResectGauge(containerEl, resectResult, options)
 *   - renderResponseGauge(containerEl, calcType, calcResult, options)
 *
 * Zero external libraries; reactive to Light/Dark themes via CSS custom properties;
 * all dynamic text strictly XML-escaped.
 */

const XML_ESCAPE_MAP = Object.freeze({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
});

function escapeXml(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).replace(/[&<>"']/g, (ch) => XML_ESCAPE_MAP[ch]);
}

function wrapText(text, maxChars = 48, maxLines = 3) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return [""];
  const words = clean.split(" ");
  const lines = [];
  let current = "";

  for (const word of words) {
    if (!current) {
      current = word;
    } else if (current.length + 1 + word.length <= maxChars) {
      current += " " + word;
    } else {
      lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) {
        break;
      }
    }
  }

  // Gather any remaining words into the final line if we broke early
  const consumedCount = lines.reduce((acc, ln) => acc + ln.split(" ").length, 0);
  const remainingWords = words.slice(consumedCount);
  let lastLine = remainingWords.join(" ");
  if (lastLine.length > maxChars + 4) {
    lastLine = lastLine.slice(0, maxChars).trimEnd() + "…";
  }
  if (lastLine) {
    lines.push(lastLine);
  }
  return lines.length > 0 ? lines : [""];
}

function formatPctLabel(val) {
  if (val === null || val === undefined || Number.isNaN(val)) {
    return "N/A";
  }
  if (!Number.isFinite(val)) {
    return val > 0 ? "+∞%" : "-∞%";
  }
  const rounded = Math.round(val * 10) / 10;
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded.toFixed(1)}%`;
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function mountSvg(containerEl, svgMarkup) {
  if (!containerEl) return null;
  containerEl.innerHTML = svgMarkup;
  return containerEl.querySelector("svg");
}

function riskColorToken(riskLevel, hasAnyBlocker) {
  if (hasAnyBlocker || riskLevel === "Critical Blocker") {
    return "var(--status-critical)";
  }
  switch (riskLevel) {
    case "Low":
      return "var(--status-pass)";
    case "Moderate":
      return "var(--status-warn)";
    case "High":
      return "var(--status-high)";
    default:
      return "var(--status-neutral)";
  }
}

/* ==========================================================================
   1. 6-Axis Neuro-AI Methodological Radar Chart
   ========================================================================== */

export function renderRadarChart(containerEl, domainScores, options = {}) {
  if (!containerEl) return null;

  const scores = Array.isArray(domainScores) ? domainScores : [];
  if (scores.length === 0) {
    return mountSvg(
      containerEl,
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 380" role="img" aria-label="6-Axis Methodological Radar Chart — No domain scores loaded">
        <title>6-Axis Methodological Radar Chart — No data</title>
        <rect x="16" y="16" width="428" height="348" rx="10" fill="var(--surface-elevated)" stroke="var(--border-subtle)" stroke-dasharray="6 4"/>
        <text x="230" y="194" text-anchor="middle" font-size="13" fill="var(--ink-muted)">Load or answer audit items to display the 6-axis domain profile.</text>
      </svg>`
    );
  }

  const cx = 230;
  const cy = 186;
  const maxR = 102;
  const count = scores.length;
  const rings = [20, 40, 60, 80, 100];
  const anyBlocker = scores.some((d) => Number(d.criticalFailedCount) > 0);
  const strokeColor = riskColorToken(options.riskLevel, anyBlocker);

  const angleFor = (idx) => (-Math.PI / 2) + (idx * 2 * Math.PI) / count;
  const pointAt = (idx, pct) => {
    const r = (clamp(Number(pct) || 0, 0, 100) / 100) * maxR;
    const theta = angleFor(idx);
    return {
      x: cx + r * Math.cos(theta),
      y: cy + r * Math.sin(theta)
    };
  };

  // Concentric reference webs
  const ringMarkup = rings.map((pct) => {
    const pts = [];
    for (let i = 0; i < count; i += 1) {
      const p = pointAt(i, pct);
      pts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
    }
    const isOuter = pct === 100;
    const stroke = isOuter ? "var(--border-strong)" : "var(--border-subtle)";
    const dash = isOuter ? "" : ` stroke-dasharray="3 3"`;
    const labelY = (cy - (pct / 100) * maxR + 3).toFixed(1);
    return [
      `<polygon points="${pts.join(" ")}" fill="none" stroke="${stroke}" stroke-width="${isOuter ? "1.3" : "1"}"${dash}/>`,
      `<text x="${(cx + 5).toFixed(1)}" y="${labelY}" font-family="var(--font-mono)" font-size="9" fill="var(--ink-muted)">${pct}%</text>`
    ].join("");
  }).join("\n");

  // Spokes
  const spokesMarkup = scores.map((_d, idx) => {
    const outer = pointAt(idx, 100);
    return `<line x1="${cx}" y1="${cy}" x2="${outer.x.toFixed(1)}" y2="${outer.y.toFixed(1)}" stroke="var(--border-subtle)" stroke-width="1"/>`;
  }).join("\n");

  // Data polygon
  const dataPoints = scores.map((d, idx) => pointAt(idx, d.score));
  const dataPolyStr = dataPoints.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  // Vertices & axis labels
  const verticesMarkup = scores.map((d, idx) => {
    const pt = dataPoints[idx];
    const scoreVal = clamp(Math.round(Number(d.score) || 0), 0, 100);
    const critFails = Number(d.criticalFailedCount) || 0;
    const isBlocker = critFails > 0;
    const dotFill = isBlocker ? "var(--status-critical)" : strokeColor;

    const halo = isBlocker
      ? `<circle cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="13.5" fill="var(--status-critical)" fill-opacity="0.12" stroke="var(--status-critical)" stroke-width="1.2" stroke-dasharray="3 2"/>
         <circle cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="9" fill="none" stroke="var(--status-critical)" stroke-width="1.6"/>`
      : "";

    const theta = angleFor(idx);
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);

    let anchor = "middle";
    let lx = cx + (maxR + 24) * cos;
    let ly = cy + (maxR + 24) * sin;

    if (Math.abs(cos) < 0.2) {
      anchor = "middle";
      ly = sin < 0 ? cy - maxR - 30 : cy + maxR + 26;
    } else if (cos > 0) {
      anchor = "start";
      lx = cx + maxR * cos + 18;
      ly = cy + maxR * sin - 4;
    } else {
      anchor = "end";
      lx = cx + maxR * cos - 18;
      ly = cy + maxR * sin - 4;
    }

    const shortTitle = escapeXml(d.shortTitle || d.title || d.domainId);
    const blockerSuffix = isBlocker ? ` · ${critFails} BLOCKER` : "";
    const scoreFill = isBlocker ? "var(--status-critical)" : "var(--ink-secondary)";

    return [
      halo,
      `<circle cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="4.8" fill="${dotFill}" stroke="var(--surface-card)" stroke-width="1.8"/>`,
      `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${anchor}" font-size="11" font-weight="700" fill="var(--ink-primary)">${shortTitle}</text>`,
      `<text x="${lx.toFixed(1)}" y="${(ly + 14).toFixed(1)}" text-anchor="${anchor}" font-family="var(--font-mono)" font-size="10.5" font-weight="700" fill="${scoreFill}">${scoreVal}%${escapeXml(blockerSuffix)}</text>`
    ].join("\n");
  }).join("\n");

  const summaryTitle = `6-Axis Neuro-AI Methodological Rigor Radar Chart. ${scores
    .map((d) => `${d.shortTitle || d.title}: ${d.score}%${d.criticalFailedCount > 0 ? ` (${d.criticalFailedCount} critical blocker failed)` : ""}`)
    .join("; ")}`;

  const footerLegend = anyBlocker
    ? `<circle cx="104" cy="364" r="5" fill="none" stroke="var(--status-critical)" stroke-width="1.5"/>
       <circle cx="104" cy="364" r="2.2" fill="var(--status-critical)"/>
       <text x="114" y="368" font-family="var(--font-mono)" font-size="9.5" fill="var(--status-critical)">Double crimson halo marks domain with failed Critical Blocker(s)</text>`
    : `<text x="230" y="368" text-anchor="middle" font-family="var(--font-mono)" font-size="9.5" fill="var(--ink-muted)">Weighted domain rigor scale (0–100%) · N/A items excluded from denominator</text>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 380" role="img" aria-label="${escapeXml(summaryTitle)}">
  <title>${escapeXml(summaryTitle)}</title>
  <rect x="0" y="0" width="460" height="380" rx="8" fill="transparent"/>
  ${ringMarkup}
  ${spokesMarkup}
  <polygon points="${dataPolyStr}" fill="${strokeColor}" fill-opacity="0.20" stroke="${strokeColor}" stroke-width="2.4" stroke-linejoin="round"/>
  ${verticesMarkup}
  ${footerLegend}
</svg>`;

  return mountSvg(containerEl, svg);
}

/* ==========================================================================
   2. WHO CNS5 Interactive Vertical Decision Path Trace
   ========================================================================== */

export function renderDecisionTrace(containerEl, cns5Result, options = {}) {
  if (!containerEl) return null;

  const path = Array.isArray(cns5Result?.decisionPath) ? cns5Result.decisionPath : [];
  if (path.length === 0) {
    return mountSvg(
      containerEl,
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 120" role="img" aria-label="WHO CNS5 Decision Trace — No classification path available">
        <title>WHO CNS5 Decision Trace</title>
        <rect x="16" y="16" width="488" height="88" rx="10" fill="var(--surface-elevated)" stroke="var(--border-subtle)" stroke-dasharray="6 4"/>
        <text x="260" y="64" text-anchor="middle" font-size="13" fill="var(--ink-muted)">Select biomarkers and histological criteria to trace the WHO CNS5 pathway.</text>
      </svg>`
    );
  }

  const nodeX = 20;
  const nodeW = 480;
  const gapY = 24;
  let cursorY = 16;

  const statusStyles = {
    pass: {
      bg: "var(--surface-elevated)",
      border: "var(--status-pass-border)",
      accent: "var(--status-pass)",
      dash: "",
      tagText: "CRITERION",
      tagBg: "var(--status-pass-bg)",
      tagColor: "var(--status-pass)"
    },
    upgrade: {
      bg: "var(--status-critical-bg)",
      border: "var(--status-critical)",
      accent: "var(--status-critical)",
      dash: "",
      tagText: "MOLECULAR UPGRADE",
      tagBg: "var(--status-critical)",
      tagColor: "var(--ink-inverse)"
    },
    nos_nec: {
      bg: "var(--status-nos-bg)",
      border: "var(--status-nos)",
      accent: "var(--status-nos)",
      dash: ' stroke-dasharray="6 4"',
      tagText: "NOS / NEC",
      tagBg: "var(--surface-card)",
      tagColor: "var(--status-nos)"
    },
    warning: {
      bg: "var(--status-warn-bg)",
      border: "var(--status-warn)",
      accent: "var(--status-warn)",
      dash: "",
      tagText: "CAUTION",
      tagBg: "var(--surface-card)",
      tagColor: "var(--status-warn)"
    },
    terminal: {
      bg: "var(--accent-soft)",
      border: "var(--accent)",
      accent: "var(--accent)",
      dash: "",
      tagText: "INTEGRATED DIAGNOSIS",
      tagBg: "var(--accent)",
      tagColor: "var(--ink-inverse)"
    }
  };

  const rawPrefix = String(options.idPrefix || containerEl.id || "cns5").replace(/[^a-zA-Z0-9_-]/g, "-");
  const markerId = `${rawPrefix}-trace-arrow`;
  const parts = [];
  const totalSteps = path.length;

  path.forEach((step, idx) => {
    const isTerminal = step.status === "terminal";
    const style = statusStyles[step.status] || statusStyles.pass;

    // Terminal override for NOS/NEC or molecular upgrade clarity
    let termAccent = style.accent;
    let termBg = style.bg;
    let termBorder = style.border;
    let termTagBg = style.tagBg;
    let termTagColor = style.tagColor;

    if (isTerminal) {
      if (cns5Result.molecularUpgradeTriggered) {
        termAccent = "var(--status-critical)";
        termBg = "var(--status-critical-bg)";
        termBorder = "var(--status-critical)";
        termTagBg = "var(--status-critical)";
        termTagColor = "var(--ink-inverse)";
      } else if (cns5Result.nosNecStatus && cns5Result.nosNecStatus !== "none") {
        termAccent = "var(--status-nos)";
        termBg = "var(--status-nos-bg)";
        termBorder = "var(--status-nos)";
        termTagBg = "var(--status-nos)";
        termTagColor = "var(--ink-inverse)";
      }
    }

    const valueLines = wrapText(step.value || "", isTerminal ? 46 : 52, 2);
    const outcomeLines = wrapText(step.outcome || "", 58, 3);

    const headerH = 28;
    const valueH = valueLines.length * 16;
    const outcomeH = outcomeLines.length * 15;
    const nodeH = Math.max(76, headerH + valueH + outcomeH + 22);

    const stepNum = isTerminal ? "DX" : String(idx + 1).padStart(2, "0");
    const labelText = escapeXml(step.label || `Step ${idx + 1}`);
    const tagLabel = isTerminal
      ? escapeXml(cns5Result.gradeDisplay || style.tagText)
      : escapeXml(style.tagText);
    const tagW = Math.min(188, Math.max(82, tagLabel.length * 6.5 + 16));
    const tagX = nodeX + nodeW - tagW - 12;

    // Node card
    parts.push(`<g data-step-id="${escapeXml(step.stepId || `step_${idx}`)}">`);
    parts.push(
      `  <rect x="${nodeX}" y="${cursorY}" width="${nodeW}" height="${nodeH}" rx="10" fill="${termBg}" stroke="${termBorder}" stroke-width="${isTerminal || step.status === "upgrade" ? "1.8" : "1.2"}"${style.dash}/>`
    );
    // Left accent bar
    parts.push(
      `  <rect x="${nodeX + 1}" y="${cursorY + 6}" width="4" height="${nodeH - 12}" rx="2" fill="${termAccent}"/>`
    );
    // Step pill
    parts.push(
      `  <rect x="${nodeX + 14}" y="${cursorY + 10}" width="28" height="18" rx="4" fill="${termAccent}"/>`
    );
    parts.push(
      `  <text x="${nodeX + 28}" y="${cursorY + 22.5}" text-anchor="middle" font-family="var(--font-mono)" font-size="9.5" font-weight="800" fill="var(--ink-inverse)">${stepNum}</text>`
    );
    // Step label
    parts.push(
      `  <text x="${nodeX + 50}" y="${cursorY + 22.5}" font-size="11.5" font-weight="700" fill="var(--ink-secondary)">${labelText}</text>`
    );
    // Status / Grade tag
    parts.push(
      `  <rect x="${tagX.toFixed(1)}" y="${cursorY + 9}" width="${tagW.toFixed(1)}" height="19" rx="9.5" fill="${termTagBg}" stroke="${termBorder}" stroke-opacity="0.4" stroke-width="0.8"/>`
    );
    parts.push(
      `  <text x="${(tagX + tagW / 2).toFixed(1)}" y="${cursorY + 21.5}" text-anchor="middle" font-family="var(--font-mono)" font-size="9" font-weight="800" fill="${termTagColor}">${tagLabel}</text>`
    );

    // Value lines
    let textY = cursorY + 42;
    valueLines.forEach((ln) => {
      parts.push(
        `  <text x="${nodeX + 16}" y="${textY}" font-size="${isTerminal ? "13" : "12"}" font-weight="800" fill="var(--ink-primary)">${escapeXml(ln)}</text>`
      );
      textY += 16;
    });

    // Outcome lines
    textY += 2;
    outcomeLines.forEach((ln) => {
      parts.push(
        `  <text x="${nodeX + 16}" y="${textY}" font-size="11" fill="var(--ink-muted)">${escapeXml(ln)}</text>`
      );
      textY += 15;
    });

    parts.push(`</g>`);

    // Connector arrow to next node
    if (idx < totalSteps - 1) {
      const arrowY1 = cursorY + nodeH;
      const arrowY2 = cursorY + nodeH + gapY - 3;
      parts.push(
        `<line x1="260" y1="${arrowY1}" x2="260" y2="${arrowY2}" stroke="var(--border-strong)" stroke-width="1.8" marker-end="url(#${escapeXml(markerId)})"/>`
      );
    }

    cursorY += nodeH + (idx < totalSteps - 1 ? gapY : 16);
  });

  const totalH = Math.max(120, cursorY);
  const ariaSummary = `WHO CNS5 Decision Trace for ${cns5Result.diagnosis || "unknown diagnosis"} (${cns5Result.gradeDisplay || ""}) with ${totalSteps} decision steps.`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 ${totalH}" role="img" aria-label="${escapeXml(ariaSummary)}">
  <title>${escapeXml(ariaSummary)}</title>
  <defs>
    <marker id="${escapeXml(markerId)}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
      <path d="M 1 1.5 L 8.5 5 L 1 8.5 z" fill="var(--border-strong)"/>
    </marker>
  </defs>
  ${parts.join("\n  ")}
</svg>`;

  return mountSvg(containerEl, svg);
}

/* ==========================================================================
   3. RANO-Resect 6-Tier Segmented Gauge (Karschnia et al., 2023)
   ========================================================================== */

export function renderResectGauge(containerEl, resectResult, options = {}) {
  if (!containerEl) return null;

  if (!resectResult || !resectResult.valid) {
    return mountSvg(
      containerEl,
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 156" role="img" aria-label="RANO-Resect Gauge — Invalid or incomplete inputs">
        <title>RANO-Resect Classification Gauge — Invalid Inputs</title>
        <rect x="16" y="18" width="488" height="120" rx="10" fill="var(--surface-elevated)" stroke="var(--border-strong)" stroke-dasharray="6 4"/>
        <text x="260" y="74" text-anchor="middle" font-size="13" font-weight="700" fill="var(--ink-secondary)">Enter valid non-negative volumes to evaluate RANO-Resect class</text>
        <text x="260" y="96" text-anchor="middle" font-size="11" fill="var(--ink-muted)">Karschnia et al., Neuro-Oncology 2023 (Classes 1–4 + Non-CE N/A Guard)</text>
      </svg>`
    );
  }

  if (resectResult.resectClass === "N/A" || resectResult.naGuardTriggered) {
    const ariaText = "RANO-Resect Not Applicable — Pre-Op CE Volume is 0 cm³. Standard CE RANO-Resect does not apply.";
    return mountSvg(
      containerEl,
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 162" role="img" aria-label="${escapeXml(ariaText)}">
        <title>${escapeXml(ariaText)}</title>
        <rect x="16" y="16" width="488" height="130" rx="10" fill="var(--status-neutral-bg)" stroke="var(--status-neutral-border)" stroke-width="1.5" stroke-dasharray="6 4"/>
        <rect x="176" y="32" width="168" height="22" rx="11" fill="var(--surface-card)" stroke="var(--status-neutral-border)"/>
        <text x="260" y="46.5" text-anchor="middle" font-family="var(--font-mono)" font-size="10" font-weight="800" fill="var(--status-neutral)">N/A · NON-CE GUARD</text>
        <text x="260" y="82" text-anchor="middle" font-size="13.5" font-weight="800" fill="var(--ink-primary)">Pre-Op CE Volume = 0 cm³ — Standard CE RANO-Resect Not Applicable</text>
        <text x="260" y="106" text-anchor="middle" font-size="11.2" fill="var(--ink-secondary)">Evaluate non-enhancing / IDH-mutant gliomas using non-CE FLAIR volumetric</text>
        <text x="260" y="123" text-anchor="middle" font-size="11.2" fill="var(--ink-secondary)">extent-of-resection frameworks (Karschnia et al., 2023/2024).</text>
      </svg>`
    );
  }

  const tiers = [
    { id: "Class 1", sub: "Supramax.", rule: "0 CE & ≤5 nCE", color: "var(--status-pass)" },
    { id: "Class 2A", sub: "Complete CE", rule: "0 cm³ CE", color: "var(--status-good)" },
    { id: "Class 2B", sub: "Near-Total", rule: "≤1 cm³ CE", color: "var(--clinical-blue)" },
    { id: "Class 3A", sub: "Subtotal", rule: "≤5 cm³ CE", color: "var(--status-warn)" },
    { id: "Class 3B", sub: "Partial", rule: ">5 cm³ CE", color: "var(--status-high)" },
    { id: "Class 4", sub: "Biopsy", rule: "Biopsy / ≤0%", color: "var(--status-critical)" }
  ];

  const startX = 16;
  const gap = 5;
  const segW = (488 - gap * 5) / 6; // ~77.17px
  const barY = 76;
  const barH = 42;
  const activeIdx = tiers.findIndex((t) => t.id === resectResult.resectClass);

  // Category super-headers
  const superGroups = [
    { label: "SUPRAMAX", start: 0, span: 1 },
    { label: "MAXIMAL (2A–2B)", start: 1, span: 2 },
    { label: "SUBMAXIMAL (3A–3B)", start: 3, span: 2 },
    { label: "BIOPSY", start: 5, span: 1 }
  ];

  const superMarkup = superGroups.map((grp) => {
    const x1 = startX + grp.start * (segW + gap);
    const w = grp.span * segW + (grp.span - 1) * gap;
    const mid = x1 + w / 2;
    return [
      `<line x1="${(x1 + 3).toFixed(1)}" y1="26" x2="${(x1 + w - 3).toFixed(1)}" y2="26" stroke="var(--border-strong)" stroke-width="1.2"/>`,
      `<text x="${mid.toFixed(1)}" y="20" text-anchor="middle" font-family="var(--font-mono)" font-size="8.5" font-weight="700" fill="var(--ink-muted)">${grp.label}</text>`
    ].join("");
  }).join("\n");

  const segMarkup = tiers.map((tier, idx) => {
    const x = startX + idx * (segW + gap);
    const mid = x + segW / 2;
    const isActive = idx === activeIdx;
    const fillOpacity = isActive ? "0.94" : "0.18";
    const strokeW = isActive ? "2.2" : "1";
    const titleFill = isActive ? "var(--ink-inverse)" : "var(--ink-primary)";
    const subFill = isActive ? "var(--ink-inverse)" : "var(--ink-secondary)";

    return [
      `<rect x="${x.toFixed(1)}" y="${barY}" width="${segW.toFixed(1)}" height="${barH}" rx="7" fill="${tier.color}" fill-opacity="${fillOpacity}" stroke="${tier.color}" stroke-width="${strokeW}"/>`,
      `<text x="${mid.toFixed(1)}" y="${barY + 18}" text-anchor="middle" font-family="var(--font-mono)" font-size="11" font-weight="800" fill="${titleFill}">${tier.id}</text>`,
      `<text x="${mid.toFixed(1)}" y="${barY + 33}" text-anchor="middle" font-size="9.5" font-weight="600" fill="${subFill}">${tier.sub}</text>`,
      `<text x="${mid.toFixed(1)}" y="${barY + barH + 17}" text-anchor="middle" font-family="var(--font-mono)" font-size="8.6" font-weight="${isActive ? "800" : "600"}" fill="${isActive ? tier.color : "var(--ink-muted)"}">${escapeXml(tier.rule)}</text>`
    ].join("\n");
  }).join("\n");

  let pointerMarkup = "";
  if (activeIdx >= 0) {
    const activeTier = tiers[activeIdx];
    const px = startX + activeIdx * (segW + gap) + segW / 2;
    const eorStr = resectResult.ceReductionPct !== null ? `${resectResult.ceReductionPct.toFixed(1)}% EOR` : "N/A";
    const readout = `Residual CE ${resectResult.postOpCeVolCm3} cm³ · ${eorStr}`;
    const pillW = Math.min(260, Math.max(150, readout.length * 6.5 + 18));
    const pillX = clamp(px - pillW / 2, 16, 504 - pillW);

    pointerMarkup = [
      `<rect x="${pillX.toFixed(1)}" y="35" width="${pillW.toFixed(1)}" height="23" rx="6" fill="var(--surface-card)" stroke="${activeTier.color}" stroke-width="1.5"/>`,
      `<text x="${(pillX + pillW / 2).toFixed(1)}" y="50" text-anchor="middle" font-family="var(--font-mono)" font-size="10" font-weight="800" fill="${activeTier.color}">${escapeXml(readout)}</text>`,
      `<polygon points="${px.toFixed(1)},73 ${(px - 6).toFixed(1)},63 ${(px + 6).toFixed(1)},63" fill="${activeTier.color}"/>`
    ].join("\n");
  }

  const nonCeFooter =
    resectResult.postOpNonCeVolCm3 !== null && resectResult.postOpNonCeVolCm3 !== undefined
      ? `Residual Non-CE (FLAIR): ${resectResult.postOpNonCeVolCm3} cm³${resectResult.nonCeReductionPct !== null ? ` (${resectResult.nonCeReductionPct.toFixed(1)}% reduction)` : ""}`
      : "Residual Non-CE (FLAIR) not supplied · Required (≤5.0 cm³) alongside 0 cm³ CE to confirm Class 1";

  const ariaSummary = `RANO-Resect Classification: ${resectResult.resectClass} (${resectResult.className}), residual CE ${resectResult.postOpCeVolCm3} cm³, EOR ${resectResult.ceReductionPct ?? "N/A"}%.`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 176" role="img" aria-label="${escapeXml(ariaSummary)}">
  <title>${escapeXml(ariaSummary)}</title>
  ${superMarkup}
  ${pointerMarkup}
  ${segMarkup}
  <text x="260" y="164" text-anchor="middle" font-family="var(--font-mono)" font-size="9.2" fill="var(--ink-muted)">${escapeXml(nonCeFooter)}</text>
</svg>`;

  return mountSvg(containerEl, svg);
}

/* ==========================================================================
   4. RANO 2.0 & RANO-BM Bidirectional Percentage Response Gauge
   ========================================================================== */

export function renderResponseGauge(containerEl, calcType, calcResult, options = {}) {
  if (!containerEl) return null;

  if (!calcResult || !calcResult.valid) {
    return mountSvg(
      containerEl,
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 160" role="img" aria-label="RANO Response Gauge — Invalid inputs">
        <title>RANO Response Threshold Gauge — Invalid Inputs</title>
        <rect x="16" y="18" width="488" height="124" rx="10" fill="var(--surface-elevated)" stroke="var(--border-strong)" stroke-dasharray="6 4"/>
        <text x="260" y="84" text-anchor="middle" font-size="13" fill="var(--ink-muted)">Enter valid non-negative measurements to visualize response thresholds.</text>
      </svg>`
    );
  }

  const isBm = calcType === "rano_bm";
  const trackX = 36;
  const trackW = 448;
  const trackY = 92;
  const trackH = 28;
  const minPct = -100;
  const maxPct = 60;

  const pctToX = (pct) => {
    const clamped = clamp(pct, minPct, maxPct);
    return trackX + ((clamped - minPct) / (maxPct - minPct)) * trackW;
  };

  // Thresholds
  const prPct = isBm ? -30 : (calcResult.thresholds?.prPct ?? -50);
  const mrPct = isBm ? null : (calcResult.thresholds?.mrPct ?? null);
  const pdPct = isBm ? 20 : (calcResult.thresholds?.pdPct ?? 25);

  const zones = [];
  zones.push({
    from: -100,
    to: prPct,
    label: isBm ? "CNS PR / CR" : "PR / CR",
    color: "var(--status-pass)"
  });

  if (mrPct !== null) {
    zones.push({
      from: prPct,
      to: mrPct,
      label: "MR (LGG)",
      color: "var(--status-good)"
    });
    zones.push({
      from: mrPct,
      to: pdPct,
      label: "SD",
      color: "var(--clinical-blue)"
    });
  } else {
    zones.push({
      from: prPct,
      to: pdPct,
      label: isBm ? "CNS SD" : "SD",
      color: "var(--clinical-blue)"
    });
  }

  zones.push({
    from: pdPct,
    to: 60,
    label: isBm ? "PD (+20% & ≥5mm)" : "PD",
    color: "var(--status-critical)"
  });

  const zonesMarkup = zones.map((z, idx) => {
    const x1 = pctToX(z.from);
    const x2 = pctToX(z.to);
    const w = Math.max(0, x2 - x1);
    const mid = x1 + w / 2;
    const rx = idx === 0 || idx === zones.length - 1 ? 4 : 0;
    return [
      `<rect x="${x1.toFixed(1)}" y="${trackY}" width="${w.toFixed(1)}" height="${trackH}" rx="${rx}" fill="${z.color}" fill-opacity="0.20" stroke="${z.color}" stroke-opacity="0.55" stroke-width="1"/>`,
      w >= 46
        ? `<text x="${mid.toFixed(1)}" y="${trackY + 17.5}" text-anchor="middle" font-family="var(--font-mono)" font-size="9.5" font-weight="800" fill="${z.color}">${escapeXml(z.label)}</text>`
        : ""
    ].join("");
  }).join("\n");

  // Reference ticks
  const tickValues = [-100, prPct];
  if (mrPct !== null) tickValues.push(mrPct);
  tickValues.push(0, pdPct, 60);

  const ticksMarkup = tickValues.map((val) => {
    const x = pctToX(val);
    const isZero = val === 0;
    const lbl = val === 60 ? "+60%+" : (val > 0 ? `+${val}%` : `${val}%`);
    return [
      `<line x1="${x.toFixed(1)}" y1="${trackY - (isZero ? 5 : 2)}" x2="${x.toFixed(1)}" y2="${trackY + trackH + 6}" stroke="${isZero ? "var(--ink-primary)" : "var(--border-strong)"}" stroke-width="${isZero ? "1.6" : "1"}"${isZero ? ' stroke-dasharray="3 2"' : ""}/>`,
      `<text x="${x.toFixed(1)}" y="${trackY + trackH + 18}" text-anchor="middle" font-family="var(--font-mono)" font-size="9.2" font-weight="${isZero ? "800" : "600"}" fill="${isZero ? "var(--ink-primary)" : "var(--ink-muted)"}">${lbl}</text>`
    ].join("");
  }).join("\n");

  // Modifier pills along top
  const pills = [];
  if (calcResult.preliminaryPdRuleApplied) {
    pills.push({ text: "PRELIM-PD (≤12w POST-RT)", bg: "var(--status-warn-bg)", color: "var(--status-warn)", border: "var(--status-warn)" });
  }
  if (calcResult.steroidDowngradeApplied) {
    pills.push({ text: "STEROID DOWNGRADE", bg: "var(--status-warn-bg)", color: "var(--status-warn)", border: "var(--status-warn)" });
  }
  if (calcResult.baselineGuardTriggered) {
    pills.push({ text: "BASELINE=0 CR GUARD", bg: "var(--status-nos-bg)", color: "var(--status-nos)", border: "var(--status-nos)" });
  }
  if (calcResult.compartmentDiscordance) {
    pills.push({ text: "CNS / NON-CNS DISCORDANCE", bg: "var(--status-high-bg)", color: "var(--status-high)", border: "var(--status-high)" });
  }
  if (isBm && calcResult.pdCriteriaMet?.pctGte20 && !calcResult.pdCriteriaMet?.absGte5mm) {
    pills.push({ text: `Δ NADIR ${calcResult.absChangeFromNadirMm >= 0 ? "+" : ""}${calcResult.absChangeFromNadirMm}mm (<5mm GUARD)`, bg: "var(--clinical-blue-soft)", color: "var(--clinical-blue)", border: "var(--clinical-blue)" });
  }

  let pillCursorX = 20;
  const pillsMarkup = pills.slice(0, 3).map((pill) => {
    const w = Math.min(230, pill.text.length * 6.0 + 18);
    const x = pillCursorX;
    pillCursorX += w + 8;
    return [
      `<rect x="${x.toFixed(1)}" y="10" width="${w.toFixed(1)}" height="21" rx="10.5" fill="${pill.bg}" stroke="${pill.border}" stroke-width="1"/>`,
      `<text x="${(x + w / 2).toFixed(1)}" y="23.5" text-anchor="middle" font-family="var(--font-mono)" font-size="8.6" font-weight="800" fill="${pill.color}">${escapeXml(pill.text)}</text>`
    ].join("");
  }).join("\n");

  // Markers for % vs Baseline (Diamond, top) and % vs Nadir (Circle, bottom)
  const pctBase = calcResult.pctChangeFromBaseline;
  const pctNadir = calcResult.pctChangeFromNadir;

  let baseMarkerMarkup = "";
  if (pctBase !== null && pctBase !== undefined && !Number.isNaN(pctBase)) {
    const numericBase = Number.isFinite(pctBase) ? pctBase : (pctBase > 0 ? 60 : -100);
    const bx = pctToX(numericBase);
    const labelStr = `Base: ${formatPctLabel(pctBase)}`;
    const lblW = Math.max(82, labelStr.length * 6.4 + 14);
    const lblX = clamp(bx - lblW / 2, 16, 504 - lblW);

    baseMarkerMarkup = [
      `<line x1="${bx.toFixed(1)}" y1="68" x2="${bx.toFixed(1)}" y2="${trackY}" stroke="var(--clinical-blue)" stroke-width="1.5"/>`,
      `<polygon points="${bx.toFixed(1)},${trackY - 7} ${(bx + 6).toFixed(1)},${trackY} ${bx.toFixed(1)},${trackY + 7} ${(bx - 6).toFixed(1)},${trackY}" fill="var(--clinical-blue)" stroke="var(--surface-card)" stroke-width="1.5"/>`,
      `<rect x="${lblX.toFixed(1)}" y="46" width="${lblW.toFixed(1)}" height="21" rx="5" fill="var(--surface-card)" stroke="var(--clinical-blue)" stroke-width="1.3"/>`,
      `<text x="${(lblX + lblW / 2).toFixed(1)}" y="60" text-anchor="middle" font-family="var(--font-mono)" font-size="9.8" font-weight="800" fill="var(--clinical-blue)">${escapeXml(labelStr)}</text>`
    ].join("\n");
  }

  let nadirMarkerMarkup = "";
  if (pctNadir !== null && pctNadir !== undefined && !Number.isNaN(pctNadir)) {
    const numericNadir = Number.isFinite(pctNadir) ? pctNadir : (pctNadir > 0 ? 60 : -100);
    const nx = pctToX(numericNadir);
    const inPdZone = numericNadir >= pdPct;
    const nColor = inPdZone ? "var(--status-critical)" : "var(--accent)";
    const absSuffix = isBm && Number.isFinite(calcResult.absChangeFromNadirMm)
      ? ` (${calcResult.absChangeFromNadirMm > 0 ? "+" : ""}${calcResult.absChangeFromNadirMm}mm)`
      : "";
    const labelStr = `Nadir: ${formatPctLabel(pctNadir)}${absSuffix}`;
    const lblW = Math.max(92, labelStr.length * 6.2 + 16);
    const lblX = clamp(nx - lblW / 2, 16, 504 - lblW);
    const markerCy = trackY + trackH;

    nadirMarkerMarkup = [
      `<line x1="${nx.toFixed(1)}" y1="${markerCy}" x2="${nx.toFixed(1)}" y2="152" stroke="${nColor}" stroke-width="1.5"/>`,
      `<circle cx="${nx.toFixed(1)}" cy="${markerCy}" r="5.6" fill="${nColor}" stroke="var(--surface-card)" stroke-width="1.6"/>`,
      `<rect x="${lblX.toFixed(1)}" y="150" width="${lblW.toFixed(1)}" height="21" rx="5" fill="var(--surface-card)" stroke="${nColor}" stroke-width="1.3"/>`,
      `<text x="${(lblX + lblW / 2).toFixed(1)}" y="164" text-anchor="middle" font-family="var(--font-mono)" font-size="9.8" font-weight="800" fill="${nColor}">${escapeXml(labelStr)}</text>`
    ].join("\n");
  }

  const codeDisplay = isBm ? calcResult.cnsResponseCode : calcResult.responseCode;
  const ariaSummary = `${calcResult.standard || calcType} Response Gauge: ${codeDisplay}. Change vs Baseline ${formatPctLabel(pctBase)}, Change vs Nadir ${formatPctLabel(pctNadir)}.`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 202" role="img" aria-label="${escapeXml(ariaSummary)}">
  <title>${escapeXml(ariaSummary)}</title>
  ${pillsMarkup}
  ${zonesMarkup}
  ${ticksMarkup}
  ${baseMarkerMarkup}
  ${nadirMarkerMarkup}
  <g font-family="var(--font-mono)" font-size="9.2" fill="var(--ink-muted)">
    <polygon points="36,189 41,184 46,189 41,194" fill="var(--clinical-blue)"/>
    <text x="52" y="192">% vs. Baseline (CR/PR/MR)</text>
    <circle cx="242" cy="189" r="4" fill="var(--accent)"/>
    <text x="252" y="192">% vs. Nadir (PD threshold${isBm ? " + ≥5mm" : ""})</text>
  </g>
</svg>`;

  return mountSvg(containerEl, svg);
}
