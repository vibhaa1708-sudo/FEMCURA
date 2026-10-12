import { useRef, useState } from "react";
import {
  Activity, ArrowRight, Bell, BookOpen, BrainCircuit,
  CheckCircle2, ChevronRight, CircleAlert, FileSearch,
  FileText, HeartPulse, LayoutDashboard, Menu, Moon,
  Microscope, Search, ShieldCheck, Sparkles, Sun,
  Upload, Users, X, Dna, ScanSearch, ChartNoAxesCombined
} from "lucide-react";
import "./App.css";
import { jsPDF } from "jspdf";

const API_URL = "http://127.0.0.1:8000";

const diseases = [
  {
    name: "PCOS / PCOD",
    category: "Reproductive health",
    description: "Explore research on hormonal health and polycystic ovary syndrome.",
    icon: HeartPulse,
    color: "lilac",
    status: "Planned",
    type: "Clinical features"
  },
  {
    name: "Breast Cancer",
    category: "Cancer research",
    description: "A potential classification model using documented diagnostic features.",
    icon: ScanSearch,
    color: "peach",
    status: "Prototype",
    type: "Diagnostic features"
  },
  {
    name: "Diabetes",
    category: "Metabolic health",
    description: "Explore labelled metabolic health data and risk factors.",
    icon: Activity,
    color: "mint",
    status: "Planned",
    type: "Health indicators"
  },
  {
    name: "More Conditions",
    category: "Growing evidence base",
    description: "Add conditions as suitable datasets and validated models become available.",
    icon: Dna,
    color: "blue",
    status: "In development",
    type: "Dataset dependent"
  }
];

const navItems = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "Disease Intelligence", icon: BrainCircuit },
  { name: "Research Lab", icon: FileText },
  { name: "Symptom Journal", icon: HeartPulse },
  { name: "Evidence Library", icon: BookOpen }
];

function formatLabel(value) {
  if (typeof value !== "string" || !value.trim()) return "Unavailable";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatScore(value) {
  return Number.isFinite(value)
    ? `${(value * 100).toFixed(1)}%`
    : "Unavailable";
}

function PredictionCard({
  title, description, prediction, score, icon: Icon, variant
}) {
  return (
    <div className={`prediction-card ${variant}`}>
      <div className="prediction-heading">
        <span className="prediction-icon"><Icon size={19} /></span>
        <span>{title}</span>
      </div>

      <strong className="prediction-value">
        {formatLabel(prediction)}
      </strong>

      <p>{description}</p>

      <div className="score-row">
        <span>Model score</span>
        <strong>{formatScore(score)}</strong>
      </div>

      <div
        className="score-track"
        role="img"
        aria-label={`Model score: ${formatScore(score)}`}
      >
        <div
          className="score-fill"
          style={{
            width: `${
              Number.isFinite(score)
                ? Math.max(0, Math.min(100, score * 100))
                : 0
            }%`
          }}
        />
      </div>
    </div>
  );
}

function App() {
  const [dark, setDark] = useState(false);
  const [active, setActive] = useState("Overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [symptoms, setSymptoms] = useState("");
  const [journal, setJournal] = useState([]);
  const [query, setQuery] = useState("");

  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analysisError, setAnalysisError] = useState("");

  // Research Gap Insights state
  const [gapInsights, setGapInsights] = useState(null);
  const [gapInsightsError, setGapInsightsError] = useState("");
  const [gapAnalyzing, setGapAnalyzing] = useState(false);

  const fileInput = useRef(null);

  const goTo = (page) => {
    setActive(page);
    setMenuOpen(false);
  };

  const handleFileSelection = (selectedFile) => {
    if (!selectedFile) return;

    const isPdf =
      selectedFile.type === "application/pdf" ||
      selectedFile.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      setAnalysisError("Please select a PDF file.");
      return;
    }

    if (selectedFile.size > 15 * 1024 * 1024) {
      setAnalysisError("Please select a PDF up to 15 MB.");
      return;
    }

    setFile(selectedFile);
    setAnalysisResult(null);
    setAnalysisError("");
    setGapInsights(null);
    setGapInsightsError("");
  };

  const addJournalEntry = () => {
    if (!symptoms.trim()) return;

    setJournal((old) => [
      {
        id: Date.now(),
        text: symptoms.trim(),
        date: new Date().toLocaleString()
      },
      ...old
    ]);

    setSymptoms("");
  };

  // Existing PDF extraction and page classification
  const analyzePaper = async () => {
    if (!file) {
      setAnalysisError("Please select a PDF first.");
      return;
    }

    setAnalyzing(true);
    setAnalysisError("");
    setAnalysisResult(null);
    setGapInsights(null);
    setGapInsightsError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const extractionResponse = await fetch(
        `${API_URL}/analyze-paper`,
        {
          method: "POST",
          body: formData
        }
      );

      const extractionData = await extractionResponse.json();

      if (!extractionResponse.ok) {
        throw new Error(
          extractionData.detail || "Could not extract PDF text."
        );
      }

      const readablePages = (extractionData.pages || []).filter(
        (page) => page.text && page.text.trim()
      );

      const results = [];

      for (const page of readablePages) {
        const pageText = page.text.trim().slice(0, 20000);

        const predictionResponse = await fetch(
          `${API_URL}/predict-passage`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json"
            },
            body: JSON.stringify({ text: pageText })
          }
        );

        const predictionData = await predictionResponse.json();

        if (!predictionResponse.ok) {
          throw new Error(
            predictionData.detail ||
            `Prediction failed on page ${page.page}.`
          );
        }

        results.push({
          page: page.page,
          text: pageText,
          ...predictionData
        });
      }

      setAnalysisResult({
        filename: extractionData.filename,
        totalPages: extractionData.total_pages,
        extractedCharacters: extractionData.extracted_characters,
        results
      });
    } catch (error) {
      setAnalysisError(
        error.message ||
        "Could not connect to FEMCURA. Check that the backend is running."
      );
    } finally {
      setAnalyzing(false);
    }
  };

  // New Research Gap Insights feature
  const analyzeResearchGaps = async () => {
    if (!analysisResult?.results?.length) {
      setGapInsightsError(
        "Analyze a readable research paper before generating insights."
      );
      return;
    }

    setGapAnalyzing(true);
    setGapInsightsError("");
    setGapInsights(null);

    try {
      const passages = analysisResult.results
        .map((result) => result.text)
        .filter((text) => text && text.trim())
        .slice(0, 200);

      if (!passages.length) {
        throw new Error("No readable passages are available for review.");
      }

      const response = await fetch(
        `${API_URL}/research-gap-insights`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json"
          },
          body: JSON.stringify({ passages })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Could not generate research gap insights."
        );
      }

      // Keep the original PDF page number alongside its source passage.
      const pageByPassage = new Map(
        analysisResult.results.map((result) => [result.text, result.page])
      );

      const evidence = (data.evidence || []).map((item) => ({
        ...item,
        source_page: pageByPassage.get(item.original_passage) ?? null
      }));

      setGapInsights({
        ...data,
        evidence
      });
    } catch (error) {
      setGapInsightsError(
        error.message ||
        "Could not connect to the Research Gap Insights endpoint."
      );
    } finally {
      setGapAnalyzing(false);
    }
  };

  // Export the current analysis and (if available) research-gap insights to PDF.
  const downloadResearchReport = () => {
    if (!analysisResult) return;

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 48;
    const maxWidth = pageWidth - margin * 2;
    let y = margin;

    const addPageIfNeeded = (needed = 18) => {
      if (y + needed > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
    };

    const writeText = (value, options = {}) => {
      const { size = 10, bold = false, gapAfter = 8, indent = 0, color = [48, 54, 67] } = options;
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(size);
      doc.setTextColor(...color);
      const lines = doc.splitTextToSize(String(value ?? "Unavailable"), maxWidth - indent);
      const lineHeight = size * 1.4;
      lines.forEach((line) => {
        addPageIfNeeded(lineHeight);
        doc.text(line, margin + indent, y);
        y += lineHeight;
      });
      y += gapAfter;
    };

    const writeHeading = (value) => writeText(value, {
      size: 14, bold: true, gapAfter: 7, color: [93, 68, 145],
    });

    writeText("FEMCURA", { size: 22, bold: true, gapAfter: 3, color: [93, 68, 145] });
    writeText("Research Paper Analysis Report", { size: 16, bold: true, gapAfter: 14 });
    writeText(`Source file: ${analysisResult.filename || "Uploaded research paper"}`, { bold: true, gapAfter: 4 });
    writeText(`Report generated: ${new Date().toLocaleString()}`, { gapAfter: 4 });
    writeText(`Total PDF pages: ${analysisResult.totalPages ?? "Unavailable"}`, { gapAfter: 4 });
    writeText(`Extracted characters: ${(analysisResult.extractedCharacters || 0).toLocaleString()}`, { gapAfter: 4 });
    writeText(`Pages classified: ${analysisResult.results?.length || 0}`, { gapAfter: 12 });

    writeHeading("Important interpretation notice");
    writeText(
      "This report contains experimental AI-assisted classifications and exploratory indicators. Draft labels have not been independently validated as scientific ground truth. Model scores are not calibrated probabilities and may be incorrect. A prediction of “no” does not prove that a topic is absent from the full paper. Check the original paper and surrounding context. This report is not clinical advice and must not be used for diagnosis or treatment decisions.",
      { gapAfter: 14 }
    );

    writeHeading("Page-by-page classification");
    (analysisResult.results || []).forEach((result) => {
      writeText(`Page ${result.page}`, { size: 12, bold: true, gapAfter: 5 });
      writeText(`Policy discussion: ${formatLabel(result.policy_discussion?.prediction)} | Model score: ${formatScore(result.policy_discussion?.model_score)}`, { gapAfter: 4 });
      writeText(`Study reporting: ${formatLabel(result.study_reporting?.prediction)} | Model score: ${formatScore(result.study_reporting?.model_score)}`, { gapAfter: 7 });
      writeText("Extracted source text:", { bold: true, gapAfter: 3 });
      writeText(result.text || "No readable text extracted for this page.", { size: 9, gapAfter: 12 });
    });

    if (gapInsights) {
      writeHeading("Research Gap Insights — exploratory review");
      writeText(`Passages reviewed: ${gapInsights.total_passages_reviewed ?? "Unavailable"}`, { gapAfter: 4 });
      writeText("Category counts:", { bold: true, gapAfter: 4 });
      Object.entries(gapInsights.category_counts || {}).forEach(([category, count]) => {
        writeText(`${category}: ${count}`, { indent: 12, gapAfter: 3 });
      });
      if (gapInsights.notice) writeText(`API notice: ${gapInsights.notice}`, { gapAfter: 10 });

      writeHeading("Evidence to inspect");
      (gapInsights.evidence || []).forEach((item, index) => {
        writeText(`Evidence ${index + 1}${item.passage_number != null ? ` (passage ${item.passage_number})` : ""}`, { size: 12, bold: true, gapAfter: 4 });
        writeText(`Category: ${item.category || "Uncategorized"}`, { gapAfter: 3 });
        writeText(`Source PDF page: ${item.source_page ?? "Not available"}`, { gapAfter: 3 });
        writeText(`Explanation: ${item.explanation || "No explanation supplied."}`, { gapAfter: 3 });
        writeText(`Policy prediction: ${formatLabel(item.policy_prediction)} | Study prediction: ${formatLabel(item.study_prediction)}`, { gapAfter: 4 });
        writeText("Original passage:", { bold: true, gapAfter: 3 });
        writeText(item.original_passage || "Original passage unavailable.", { size: 9, gapAfter: 12 });
      });
    }

    const pageCount = doc.internal.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      doc.setPage(page);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(`FEMCURA · Experimental research prototype · Page ${page} of ${pageCount}`, margin, pageHeight - 22);
    }
    doc.save("FEMCURA-Research-Report.pdf");
  };

  const filteredDiseases = diseases.filter((d) =>
    `${d.name} ${d.category} ${d.description}`
      .toLowerCase()
      .includes(query.toLowerCase())
  );

  return (
    <div className={`app ${dark ? "dark" : "light"}`}>
      <aside className={`sidebar ${menuOpen ? "show" : ""}`}>
        <div className="brand">
          <div className="brand-icon">
            <div className="brand-icon-glow" />
            <Activity size={25} strokeWidth={2.1} />
            <span className="brand-icon-spark">✦</span>
          </div>

          <div>
            <h2>FEMCURA<span>.</span></h2>
            <p>WOMEN'S HEALTH INTELLIGENCE</p>
          </div>

          <button
            className="close-menu"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
          >
            <X size={19} />
          </button>
        </div>

        <div className="workspace-label">YOUR WORKSPACE</div>

        <nav>
          {navItems.map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={`nav-item ${active === name ? "selected" : ""}`}
              onClick={() => goTo(name)}
            >
              <Icon size={19} />
              <span>{name}</span>
              {name === "Research Lab" && (
                <span className="nav-new">AI</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-note">
          <div className="note-icon"><ShieldCheck size={20} /></div>
          <h3>Evidence over assumptions.</h3>
          <p>
            Making women's health research more visible, one study at a time.
          </p>
        </div>

        <div className="profile">
          <div className="avatar">F</div>
          <div className="profile-info">
            <strong>Research Workspace</strong>
            <span>Health research prototype</span>
          </div>
        </div>
      </aside>

      {menuOpen && (
        <button
          className="mobile-overlay"
          onClick={() => setMenuOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <main className="main">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <Menu size={21} />
          </button>

          <div className="breadcrumb">
            Workspace <ChevronRight size={15} />
            <span>{active}</span>
          </div>

          <div className="top-actions">
            <span className="status">
              <span /> Evidence-led research
            </span>

            <button
              className="icon-button"
              onClick={() => setDark(!dark)}
              aria-label="Toggle theme"
            >
              {dark ? <Sun size={19} /> : <Moon size={19} />}
            </button>

            <button className="icon-button" aria-label="Notifications">
              <Bell size={19} />
            </button>

            <div className="top-avatar">F</div>
          </div>
        </header>

        <section className="content">
          {active === "Overview" && (
            <>
              <div className="welcome-row">
                <div className="welcome-copy">
                  <div className="eyebrow">
                    <Sparkles size={15} />
                    WOMEN'S HEALTH · RESEARCH · AI
                  </div>

                  <h1>
                    Better evidence.<br />
                    <span>Better questions.</span>
                  </h1>

                  <p className="subtitle">
                    Explore disease research, examine clinical evidence and
                    understand what medical studies do — and do not — report.
                  </p>

                  <div className="hero-buttons">
                    <button
                      className="primary-button"
                      onClick={() => goTo("Research Lab")}
                    >
                      Analyse a paper <ArrowRight size={17} />
                    </button>

                    <button
                      className="secondary-button"
                      onClick={() => goTo("Disease Intelligence")}
                    >
                      Explore conditions
                    </button>
                  </div>
                </div>

                <div className="hero-art">
                  <div className="orbit orbit-one" />
                  <div className="orbit orbit-two" />
                  <div className="art-glow" />
                  <div className="art-card art-card-back">
                    <Microscope size={27} />
                  </div>
                  <div className="art-core">
                    <HeartPulse size={53} strokeWidth={1.35} />
                  </div>
                  <div className="art-dot dot-one" />
                  <div className="art-dot dot-two" />
                  <div className="art-mini"><Sparkles size={17} /></div>
                </div>
              </div>

              <div className="metric-grid">
                <div className="metric-card">
                  <span className="metric-icon lilac"><BrainCircuit size={20} /></span>
                  <span className="metric-label">Disease areas</span>
                  <strong>03+</strong>
                  <small>Research focus areas</small>
                </div>

                <div className="metric-card">
                  <span className="metric-icon mint"><FileSearch size={20} /></span>
                  <span className="metric-label">Research papers</span>
                  <strong>Ready to explore</strong>
                  <small>Upload a PDF to begin</small>
                </div>

                <div className="metric-card">
                  <span className="metric-icon peach"><ChartNoAxesCombined size={20} /></span>
                  <span className="metric-label">ML models</span>
                  <strong>In progress</strong>
                  <small>Availability depends on validation</small>
                </div>
              </div>

              <div className="section-heading">
                <div>
                  <h2>Disease intelligence</h2>
                  <p>A growing collection of women's health research areas.</p>
                </div>

                <button
                  className="text-button"
                  onClick={() => goTo("Disease Intelligence")}
                >
                  View all <ArrowRight size={16} />
                </button>
              </div>

              <div className="disease-grid">
                {diseases.slice(0, 3).map((d) => {
                  const Icon = d.icon;

                  return (
                    <article className="disease-card" key={d.name}>
                      <div className="disease-card-top">
                        <span className={`disease-icon ${d.color}`}><Icon size={23} /></span>
                        <span className="model-status">{d.status}</span>
                      </div>
                      <span className="disease-category">{d.category}</span>
                      <h3>{d.name}</h3>
                      <p>{d.description}</p>
                      <button className="card-link" onClick={() => goTo("Disease Intelligence")}>
                        Explore research <ArrowRight size={16} />
                      </button>
                    </article>
                  );
                })}
              </div>

              <div className="lower-grid">
                <section className="panel research-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Research Lab</h2>
                      <p>Turn a paper into structured evidence.</p>
                    </div>
                    <div className="panel-badge"><FileSearch size={19} /></div>
                  </div>

                  <div className="research-checks">
                    <div>
                      <span className="check-icon">01</span>
                      <div><strong>Who was studied?</strong><p>Participant counts and population details.</p></div>
                    </div>
                    <div>
                      <span className="check-icon">02</span>
                      <div><strong>What did they find?</strong><p>Reported outcomes and supporting evidence.</p></div>
                    </div>
                    <div>
                      <span className="check-icon">03</span>
                      <div><strong>What is missing?</strong><p>Unreported details, not assumed conclusions.</p></div>
                    </div>
                  </div>

                  <button className="panel-link" onClick={() => goTo("Research Lab")}>
                    Open Research Lab <ArrowRight size={16} />
                  </button>
                </section>

                <section className="panel quote-panel">
                  <div className="quote-mark">“</div>
                  <p className="quote">
                    Absence of reporting is a question to investigate, not proof of exclusion.
                  </p>
                  <div className="quote-line" />
                  <div className="quote-bottom">
                    <div className="quote-orb"><Users size={20} /></div>
                    <div><strong>Evidence matters.</strong><span>Read what studies actually say.</span></div>
                  </div>
                </section>
              </div>
            </>
          )}

          {active === "Disease Intelligence" && (
            <div className="page-view">
              <div className="page-intro">
                <div className="eyebrow"><BrainCircuit size={15} /> MODEL EXPLORER</div>
                <h1>Disease <span>intelligence.</span></h1>
                <p>Explore research areas and the current status of each ML prototype.</p>
              </div>

              <div className="search-box">
                <Search size={19} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search diseases or research areas..."
                />
              </div>

              <div className="notice-banner">
                <CircleAlert size={21} />
                <div>
                  <strong>Research prototype — not a diagnostic service</strong>
                  <p>
                    Models will only be enabled after dataset review and evaluation.
                    A model status is not evidence of clinical readiness.
                  </p>
                </div>
              </div>

              <div className="disease-grid disease-grid-all">
                {filteredDiseases.map((d) => {
                  const Icon = d.icon;

                  return (
                    <article className="disease-card" key={d.name}>
                      <div className="disease-card-top">
                        <span className={`disease-icon ${d.color}`}><Icon size={24} /></span>
                        <span className="model-status">{d.status}</span>
                      </div>
                      <span className="disease-category">{d.category}</span>
                      <h3>{d.name}</h3>
                      <p>{d.description}</p>
                      <div className="model-detail">
                        <span>Data type</span><strong>{d.type}</strong>
                      </div>
                      <button className="card-link" onClick={() => goTo("Research Lab")}>
                        Explore related papers <ArrowRight size={16} />
                      </button>
                    </article>
                  );
                })}

                {filteredDiseases.length === 0 && <p>No matching research areas found.</p>}
              </div>
            </div>
          )}

          {active === "Research Lab" && (
            <div className="page-view">
              <div className="page-intro">
                <div className="eyebrow"><Sparkles size={15} /> AI-ASSISTED PAPER REVIEW</div>
                <h1>Research <span>Lab.</span></h1>
                <p>
                  Upload a medical research paper to extract text and run
                  experimental research-reporting classifications.
                </p>
              </div>

              <div className="upload-layout">
                <div className="panel upload-panel">
                  <div className="upload-heading">
                    <div className="panel-badge"><FileText size={22} /></div>
                    <div><h2>Upload a research paper</h2><p>PDF format · Maximum 15 MB</p></div>
                  </div>

                  <button
                    type="button"
                    className="drop-zone"
                    onClick={() => fileInput.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleFileSelection(e.dataTransfer.files?.[0]);
                    }}
                  >
                    <span className="upload-icon"><Upload size={27} /></span>
                    <strong>{file ? file.name : "Drop your PDF here"}</strong>
                    <span>
                      {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB · Selected` : "or click to browse your files"}
                    </span>
                    <span className="browse-label">{file ? "Choose another PDF" : "Browse files"}</span>
                  </button>

                  <input
                    ref={fileInput}
                    type="file"
                    accept="application/pdf,.pdf"
                    hidden
                    onChange={(e) => {
                      handleFileSelection(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />

                  {file && (
                    <div className="selected-file">
                      <CheckCircle2 size={18} />
                      <span>PDF selected and ready for analysis.</span>
                      <button
                        type="button"
                        aria-label="Remove selected PDF"
                        onClick={() => {
                          setFile(null);
                          setAnalysisResult(null);
                          setAnalysisError("");
                          setGapInsights(null);
                          setGapInsightsError("");
                          if (fileInput.current) fileInput.current.value = "";
                        }}
                      >
                        <X size={17} />
                      </button>
                    </div>
                  )}

                  <div className="upload-info">
                    <ShieldCheck size={18} />
                    <span>Use public or de-identified research papers. Do not upload identifiable patient records.</span>
                  </div>
                </div>

                <div className="panel process-panel">
                  <h2>What we'll examine</h2>
                  <p>The current prototype extracts text and classifies each readable page.</p>

                  {[
                    ["01", "Study overview", "Extracted paper text and page count"],
                    ["02", "Policy discussion", "Predicted discussion of inclusion and representation"],
                    ["03", "Study reporting", "Predicted reporting of the current study"],
                    ["04", "Evidence review", "Inspect original page text before interpreting predictions"]
                  ].map(([n, title, desc]) => (
                    <div className="process-item" key={n}>
                      <span>{n}</span>
                      <div><strong>{title}</strong><p>{desc}</p></div>
                    </div>
                  ))}

                  <button
                    type="button"
                    className="primary-button full-button"
                    onClick={analyzePaper}
                    disabled={!file || analyzing}
                  >
                    {analyzing ? "Analyzing paper..." : file ? "Analyze research paper" : "Select a PDF to begin"}
                    {!analyzing && <ArrowRight size={17} />}
                  </button>

                  {analyzing && (
                    <p className="muted-note">
                      Processing pages. Large PDFs may take some time. Keep the backend terminal running.
                    </p>
                  )}
                </div>
              </div>

              {analysisError && (
                <div className="notice-banner">
                  <CircleAlert size={21} />
                  <div><strong>Analysis could not be completed</strong><p>{analysisError}</p></div>
                </div>
              )}

              {analysisResult && (
                <section className="analysis-results">
                  <div className="section-heading">
                    <div>
                      <div className="eyebrow"><ChartNoAxesCombined size={15} /> PAPER ANALYSIS</div>
                      <h2>Research review results</h2>
                      <p>{analysisResult.filename} · {analysisResult.totalPages} total pages</p>
                    </div>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={downloadResearchReport}
                    >
                      <FileText size={17} /> Export report PDF
                    </button>
                  </div>

                  <div className="metric-grid">
                    <div className="metric-card">
                      <span className="metric-icon lilac"><FileText size={20} /></span>
                      <span className="metric-label">Total PDF pages</span>
                      <strong>{analysisResult.totalPages}</strong>
                    </div>
                    <div className="metric-card">
                      <span className="metric-icon mint"><FileSearch size={20} /></span>
                      <span className="metric-label">Extracted characters</span>
                      <strong>{(analysisResult.extractedCharacters || 0).toLocaleString()}</strong>
                    </div>
                    <div className="metric-card">
                      <span className="metric-icon peach"><CheckCircle2 size={20} /></span>
                      <span className="metric-label">Pages classified</span>
                      <strong>{analysisResult.results.length}</strong>
                    </div>
                  </div>

                  <div className="notice-banner analysis-notice">
                    <CircleAlert size={21} />
                    <div>
                      <strong>Experimental model output — review required</strong>
                      <p>
                        These predictions use AI-assisted draft labels and have not been independently validated as scientific ground truth.
                        Model scores are not calibrated probabilities. Review source text and context before drawing conclusions.
                        Do not use these outputs for clinical decisions.
                      </p>
                    </div>
                  </div>

                  {analysisResult.results.length === 0 && (
                    <div className="panel empty-results">
                      <div className="empty-results-icon"><FileSearch size={26} /></div>
                      <h3>No readable page text found</h3>
                      <p>The PDF may be scanned or image-based. OCR support is not included in this prototype.</p>
                    </div>
                  )}

                  <div className="results-list">
                    {analysisResult.results.map((result) => {
                      const policy = result.policy_discussion;
                      const study = result.study_reporting;

                      return (
                        <article className="panel result-card" key={result.page}>
                          <div className="result-card-header">
                            <div className="result-page-icon"><FileSearch size={22} /></div>
                            <div className="result-page-title">
                              <span className="result-kicker">PAGE REVIEW</span>
                              <h3>Page {result.page}</h3>
                              <p>Experimental passage classification</p>
                            </div>
                            <span className="result-review-tag"><CircleAlert size={14} /> Review required</span>
                          </div>

                          <div className="prediction-grid">
                            <PredictionCard
                              title="Policy discussion"
                              description="Whether the passage discusses inclusion, representation or research guidance."
                              prediction={policy?.prediction}
                              score={policy?.model_score}
                              icon={Users}
                              variant="policy-card"
                            />
                            <PredictionCard
                              title="Study reporting"
                              description="Whether the passage reports this paper's own participants, methods, data or results."
                              prediction={study?.prediction}
                              score={study?.model_score}
                              icon={Microscope}
                              variant="study-card"
                            />
                          </div>

                          <div className="research-insight">
                            <span className="insight-icon"><Sparkles size={18} /></span>
                            <div>
                              <strong>How to interpret this page</strong>
                              <p>
                                These are model-generated labels, not verified findings. Read the extracted passage and check surrounding context.
                                A “no” prediction does not prove that a topic is absent from the full paper.
                              </p>
                            </div>
                          </div>

                          <details className="source-details">
                            <summary>
                              <FileText size={17} /> Inspect source text
                              <span>Page {result.page}</span>
                            </summary>
                            <div className="source-text-wrap">
                              <p className="extracted-page-text">{result.text}</p>
                            </div>
                          </details>
                        </article>
                      );
                    })}
                  </div>

                  {/* Research Gap Insights UI */}
                  <section className="gap-insights-section">
                    <div className="gap-insights-header">
                      <div>
                        <div className="eyebrow"><Sparkles size={15} /> EXPLORATORY EVIDENCE REVIEW</div>
                        <h2>Research Gap <span>Insights.</span></h2>
                        <p>
                          Identify passages worth reviewing and inspect their original evidence.
                          These indicators are exploratory, not confirmed scientific gaps.
                        </p>
                      </div>
                      <div className="gap-insights-icon"><ScanSearch size={25} /></div>
                    </div>

                    <button
                      type="button"
                      className="primary-button"
                      onClick={analyzeResearchGaps}
                      disabled={gapAnalyzing || !analysisResult.results.length}
                    >
                      {gapAnalyzing ? "Generating insights..." : gapInsights ? "Refresh gap insights" : "Generate gap insights"}
                      {!gapAnalyzing && <ArrowRight size={17} />}
                    </button>

                    {gapAnalyzing && (
                      <p className="muted-note">
                        Reviewing extracted passages. Please keep the backend running.
                      </p>
                    )}

                    {gapInsightsError && (
                      <div className="notice-banner">
                        <CircleAlert size={21} />
                        <div><strong>Could not generate insights</strong><p>{gapInsightsError}</p></div>
                      </div>
                    )}

                    {gapInsights && (
                      <>
                        <div className="gap-summary-grid">
                          <div className="metric-card">
                            <span className="metric-icon lilac"><FileSearch size={20} /></span>
                            <span className="metric-label">Passages reviewed</span>
                            <strong>{gapInsights.total_passages_reviewed}</strong>
                          </div>

                          <div className="metric-card">
                            <span className="metric-icon mint"><CheckCircle2 size={20} /></span>
                            <span className="metric-label">Evidence categories</span>
                            <strong>{Object.keys(gapInsights.category_counts || {}).length}</strong>
                          </div>

                          <div className="metric-card">
                            <span className="metric-icon peach"><CircleAlert size={20} /></span>
                            <span className="metric-label">Manual review</span>
                            <strong>{gapInsights.category_counts?.["Needs Manual Review"] || 0}</strong>
                          </div>
                        </div>

                        <div className="gap-category-list">
                          {Object.entries(gapInsights.category_counts || {}).map(([category, count]) => (
                            <div className="gap-category-item" key={category}>
                              <span>{category}</span>
                              <strong>{count}</strong>
                            </div>
                          ))}
                        </div>

                        <div className="notice-banner analysis-notice">
                          <CircleAlert size={21} />
                          <div>
                            <strong>Exploratory indicators only</strong>
                            <p>{gapInsights.notice}</p>
                          </div>
                        </div>

                        <div className="section-heading">
                          <div>
                            <h2>Evidence to inspect</h2>
                            <p>Each item includes the original passage returned by the API.</p>
                          </div>
                        </div>

                        <div className="gap-evidence-list">
                          {(gapInsights.evidence || []).map((item) => (
                            <article className="panel gap-evidence-card" key={item.passage_number}>
                              <div className="gap-evidence-top">
                                <span className="result-kicker">PASSAGE {item.passage_number}</span>
                                <span className="model-status">{item.category}</span>
                              </div>

                              <h3>{item.category}</h3>
                              <p>{item.explanation}</p>

                              <div className="gap-label-row">
                                <span>Policy: <strong>{formatLabel(item.policy_prediction)}</strong></span>
                                <span>Study: <strong>{formatLabel(item.study_prediction)}</strong></span>
                                {item.source_page && (
                                  <span>PDF page: <strong>{item.source_page}</strong></span>
                                )}
                              </div>

                              <details className="source-details">
                                <summary>
                                  <FileText size={17} />
                                  Inspect original passage
                                  <span>Evidence</span>
                                </summary>
                                <div className="source-text-wrap">
                                  <p className="extracted-page-text">{item.original_passage}</p>
                                </div>
                              </details>
                            </article>
                          ))}
                        </div>
                      </>
                    )}
                  </section>
                </section>
              )}
            </div>
          )}

          {active === "Symptom Journal" && (
            <div className="page-view">
              <div className="page-intro">
                <div className="eyebrow"><HeartPulse size={15} /> PERSONAL HEALTH NOTES</div>
                <h1>Symptom <span>Journal.</span></h1>
                <p>Keep a private-to-this-session log of observations to discuss with a qualified clinician.</p>
              </div>

              <div className="journal-layout">
                <section className="panel journal-form">
                  <h2>Record an observation</h2>
                  <p>Include what you noticed, when it started and any context you want to remember.</p>

                  <textarea
                    value={symptoms}
                    onChange={(e) => setSymptoms(e.target.value)}
                    placeholder="Example: I noticed a change in my sleep this week..."
                    rows={5}
                  />

                  <button className="primary-button" onClick={addJournalEntry}>
                    Save entry <ArrowRight size={17} />
                  </button>

                  <p className="muted-note">Entries are held in page state and are not persisted to a database.</p>
                </section>

                <section className="panel journal-entries">
                  <h2>Your timeline</h2>

                  {journal.length === 0 ? (
                    <div className="empty-state">
                      <HeartPulse size={30} />
                      <strong>No entries yet</strong>
                      <p>Your saved observations will appear here during this session.</p>
                    </div>
                  ) : (
                    journal.map((entry) => (
                      <article className="journal-entry" key={entry.id}>
                        <span>{entry.date}</span>
                        <p>{entry.text}</p>
                      </article>
                    ))
                  )}
                </section>
              </div>

              <div className="notice-banner">
                <ShieldCheck size={21} />
                <div>
                  <strong>Educational support, not diagnosis</strong>
                  <p>This journal does not diagnose conditions or recommend treatment. Seek urgent medical care for severe or rapidly worsening symptoms.</p>
                </div>
              </div>
            </div>
          )}

          {active === "Evidence Library" && (
            <div className="page-view">
              <div className="page-intro">
                <div className="eyebrow"><BookOpen size={15} /> RESEARCH KNOWLEDGE</div>
                <h1>Evidence <span>Library.</span></h1>
                <p>Build a collection of papers and resources that can be checked and compared.</p>
              </div>

              <div className="library-hero">
                <div className="library-hero-icon"><BookOpen size={34} /></div>
                <div>
                  <h2>Your evidence collection starts here.</h2>
                  <p>Analyse a paper in Research Lab, then use its findings to build a structured evidence library.</p>
                  <button className="primary-button" onClick={() => goTo("Research Lab")}>
                    Add a research paper <ArrowRight size={17} />
                  </button>
                </div>
              </div>

              <div className="section-heading">
                <div><h2>Research principles</h2><p>How FEMCURA treats scientific evidence.</p></div>
              </div>

              <div className="disease-grid">
                <article className="disease-card">
                  <span className="disease-icon lilac"><FileSearch size={23} /></span>
                  <h3>Traceable findings</h3>
                  <p>Link conclusions to source text and page references whenever available.</p>
                </article>
                <article className="disease-card">
                  <span className="disease-icon mint"><ShieldCheck size={23} /></span>
                  <h3>Honest uncertainty</h3>
                  <p>Distinguish not reported from evidence that a factor was excluded.</p>
                </article>
                <article className="disease-card">
                  <span className="disease-icon peach"><Users size={23} /></span>
                  <h3>Representation matters</h3>
                  <p>Check whether participant details and sex-disaggregated outcomes are reported.</p>
                </article>
              </div>
            </div>
          )}

          <footer className="footer">
            <span>FEMCURA <span className="footer-dot">✳</span> Evidence-led women's health</span>
            <span>Educational research prototype · Not a medical diagnosis</span>
          </footer>
        </section>
      </main>
    </div>
  );
}

export default App;
