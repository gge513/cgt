import { AnalysisReport } from "../types";

export function generateMarkdownReport(report: AnalysisReport, model?: string): string {
  const modelDisplay = model
    ? ` (Model: ${model.replace("claude-", "").split("-")[0].charAt(0).toUpperCase() + model.replace("claude-", "").split("-")[0].slice(1)})`
    : "";

  return `# Strategic Analysis Report${modelDisplay}

**Generated:** ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}

---

## Executive Summary

${report.executive_summary}

---

## Detailed Analysis

### Strategic Themes & Patterns

#### Key Themes
${report.strategic_analysis.themes.map((t: any) => `- ${t}`).join("\n")}

#### Observed Patterns
${report.strategic_analysis.patterns.map((p: any) => `- ${p}`).join("\n")}

#### Strategic Opportunities
${report.strategic_analysis.opportunities.map((o: any) => `- ${o}`).join("\n")}

#### Identified Risks
${report.strategic_analysis.risks.map((r: any) => `- ${r}`).join("\n")}

---

### Stakeholder Dynamics & Sentiment

**Overall Sentiment:** ${report.stakeholder_analysis.sentiment_overview}

**Key Participants:** ${report.stakeholder_analysis.participants.join(", ")}

#### Areas of Consensus
${report.stakeholder_analysis.consensus_points.map((cp: any) => `- ${cp}`).join("\n")}

#### Areas of Disagreement
${report.stakeholder_analysis.disagreements.map((d: any) => `- ${d}`).join("\n")}

#### Stakeholder Positions & Concerns
${Object.entries(report.stakeholder_analysis.stakeholder_positions)
  .map(([stakeholder, position]: any) => `**${stakeholder}:** ${position}`)
  .join("\n\n")}

---

### Financial & Operational Analysis

#### Financial Concerns
${report.financial_ops_analysis.financial_concerns.length > 0 ? report.financial_ops_analysis.financial_concerns.map((fc: any) => `- ${fc}`).join("\n") : "No critical financial concerns identified."}

#### Operational Bottlenecks
${report.financial_ops_analysis.operational_bottlenecks.length > 0 ? report.financial_ops_analysis.operational_bottlenecks.map((ob: any) => `- ${ob}`).join("\n") : "No major operational bottlenecks identified."}

#### Resource Constraints
${report.financial_ops_analysis.resource_constraints.length > 0 ? report.financial_ops_analysis.resource_constraints.map((rc: any) => `- ${rc}`).join("\n") : "No critical resource constraints identified."}

#### Compliance & Governance Issues
${report.financial_ops_analysis.compliance_issues.length > 0 ? report.financial_ops_analysis.compliance_issues.map((ci: any) => `- ${ci}`).join("\n") : "No immediate compliance issues identified."}

---

## Strategic Recommendations

${report.strategic_recommendations
  .map(
    (rec: any, idx: any) => `### ${idx + 1}. ${rec.title}

**Priority:** ${rec.priority.toUpperCase()}

**Description:**
${rec.description}

**Rationale:**
${rec.rationale}

**Expected Impact:**
${rec.expected_impact}
`
  )
  .join("\n---\n\n")}

---

## Implementation Timeline

| Initiative | Timeline | Dependencies | Owner |
|-----------|----------|--------------|-------|
${report.implementation_timeline
  .map(
    (item: any) =>
      `| ${item.initiative} | ${item.suggested_timeline || item.duration} | ${item.dependencies.length > 0 ? item.dependencies.join(", ") : "None"} | ${item.owner || "TBD"} |`
  )
  .join("\n")}

---

## Next Steps

1. **Review & Alignment:** Share this report with key stakeholders for feedback and alignment
2. **Prioritization:** Confirm priority levels and resource allocation for recommended initiatives
3. **Ownership:** Assign clear owners to each initiative with accountability structures
4. **Monitoring:** Establish KPIs and monitoring mechanisms for tracking progress
5. **Communication:** Develop a communication plan to roll out recommendations across the organization

---

*Report generated using Multi-Agent Strategic Analysis System*
`;
}

export function generateHTMLReport(report: AnalysisReport, model?: string): string {
  const modelDisplay = model
    ? ` (Model: ${model.replace("claude-", "").split("-")[0].charAt(0).toUpperCase() + model.replace("claude-", "").split("-")[0].slice(1)})`
    : "";

  // Simple HTML wrapper (in production, use markdown-to-html library)
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Strategic Analysis Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 900px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    h1 { color: #1a1a1a; border-bottom: 3px solid #007acc; padding-bottom: 10px; }
    h2 { color: #007acc; margin-top: 30px; }
    h3 { color: #333; }
    .metadata { color: #666; font-size: 0.9em; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
    th { background-color: #007acc; color: white; }
    ul, ol { margin: 10px 0; padding-left: 20px; }
    .section { background: white; padding: 20px; margin: 20px 0; border-radius: 5px; }
    .priority-high { color: #d32f2f; font-weight: bold; }
    .priority-medium { color: #f57c00; font-weight: bold; }
    .priority-low { color: #388e3c; font-weight: bold; }
  </style>
</head>
<body>
  <div class="section">
    <h1>Strategic Analysis Report${modelDisplay}</h1>
    <p class="metadata">Generated: ${new Date().toLocaleString()}</p>
  </div>
  <div class="section">
    <h2>Executive Summary</h2>
    <p>${report.executive_summary.replace(/\n/g, "<br>")}</p>
  </div>
  <footer style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 0.9em;">
    Report generated using Multi-Agent Strategic Analysis System
  </footer>
</body>
</html>`;
}
