import { useState, useEffect, useRef } from "react";

// ─── SCORING ENGINE ───────────────────────────────────────────────
const SCORE_BANDS = [
  { min: 80, label: "Stable", color: "#2D6A4F", bg: "#D8F3DC" },
  { min: 65, label: "Mild Instability", color: "#7B6D2E", bg: "#FFF3CD" },
  { min: 50, label: "Elevated Pattern", color: "#B45309", bg: "#FED7AA" },
  { min: 0, label: "Significant Instability", color: "#991B1B", bg: "#FEE2E2" },
];

function getBand(score) {
  return SCORE_BANDS.find((b) => score >= b.min) || SCORE_BANDS[3];
}

function calcWHR(waist, height) {
  if (!waist || !height || height === 0) return 0.55;
  return waist / height;
}

function whrScore(ratio) {
  if (ratio < 0.5) return 95;
  if (ratio < 0.55) return 78;
  if (ratio < 0.6) return 60;
  return 40;
}

function mcScore(val, map) {
  return map[val] ?? 50;
}

function computeScores(a) {
  const whr = calcWHR(parseFloat(a.waist) || 0, parseFloat(a.height) || 0);

  const bodyComp = Math.round(
    whrScore(whr) * 0.35 +
    mcScore(a.fatStorage, { abdomen: 35, hips: 65, even: 55, na: 85 }) * 0.2 +
    mcScore(a.weightDiff, { no: 90, moderate: 55, significant: 30 }) * 0.2 +
    mcScore(a.weightTrend, { stable: 90, gradual: 60, significant: 35, decreased: 70 }) * 0.15 +
    mcScore(a.resistance, { "2plus": 90, "1week": 70, occasional: 45, never: 25 }) * 0.1
  );

  const glucose = Math.round(
    mcScore(a.energyAfterMeal, { stable: 95, slight: 70, noticeable: 40, severe: 15 }) * 0.25 +
    mcScore(a.cravings, { rarely: 90, occasionally: 65, frequently: 35, daily: 15 }) * 0.2 +
    mcScore(a.delayedMeal, { mild: 90, irritable: 60, shaky: 30, avoid: 15 }) * 0.2 +
    mcScore(a.trembling, { never: 95, rarely: 70, occasionally: 40, frequently: 15 }) * 0.15 +
    mcScore(a.diabetesHistory, { none: 90, prediabetes: 40, gestational: 50, type2: 20 }) * 0.2
  );

  const liver = Math.round(
    mcScore(a.sugaryDrinks, { rarely: 90, "1to3": 65, "4to6": 35, daily: 15 }) * 0.25 +
    mcScore(a.processedFood, { rarely: 90, "1to2": 65, "3to4": 35, "5plus": 15 }) * 0.25 +
    mcScore(a.addedSugar, { rarely: 90, "1to3": 65, "4to6": 35, daily: 15 }) * 0.2 +
    mcScore(a.alcohol, { none: 90, moderate: 70, regular: 40, high: 15 }) * 0.15 +
    mcScore(a.overfull, { rarely: 90, occasionally: 65, frequently: 35, most: 15 }) * 0.15
  );

  const inflammation = Math.round(
    mcScore(a.sleepHours, { "7to9": 90, "6to7": 65, "5to6": 40, under5: 15 }) * 0.2 +
    mcScore(a.sleepConsistency, { very: 90, moderate: 65, somewhat: 40, highly: 15 }) * 0.15 +
    mcScore(a.wakeRested, { most: 90, sometimes: 60, rarely: 35, never: 15 }) * 0.2 +
    mcScore(a.stress, { low: 90, moderate: 60, high: 35, vhigh: 15 }) * 0.2 +
    mcScore(a.brainFog, { rarely: 90, occasionally: 60, frequently: 35, daily: 15 }) * 0.25
  );

  const activity = Math.round(
    mcScore(a.exerciseMin, { "150plus": 90, "75to149": 70, "30to74": 45, under30: 20 }) * 0.3 +
    mcScore(a.dailyMovement, { highly: 90, moderate: 65, mostly: 40, fully: 15 }) * 0.3 +
    mcScore(a.resistance, { "2plus": 90, "1week": 70, occasional: 45, never: 20 }) * 0.25 +
    mcScore(a.recovery, { quick: 90, moderate: 65, slow: 35, na: 50 }) * 0.15
  );

  const domains = [
    { key: "bodyComp", label: "Body Composition", score: bodyComp, icon: "◉" },
    { key: "glucose", label: "Glucose Stability", score: glucose, icon: "◈" },
    { key: "liver", label: "Liver Load Pattern", score: liver, icon: "◆" },
    { key: "inflammation", label: "Inflammation & Recovery", score: inflammation, icon: "◇" },
    { key: "activity", label: "Activity Resilience", score: activity, icon: "△" },
  ];

  const overall = Math.round(domains.reduce((s, d) => s + d.score, 0) / 5);

  // Priority logic
  const priorityOrder = ["glucose", "inflammation", "liver", "bodyComp", "activity"];
  let priority = domains.reduce((p, d) => (d.score < p.score ? d : p), domains[0]);

  const auto45 = domains.filter((d) => d.score < 45);
  if (auto45.length > 0) {
    priority = auto45.sort(
      (a, b) => priorityOrder.indexOf(a.key) - priorityOrder.indexOf(b.key)
    )[0];
  } else {
    const lowest = Math.min(...domains.map((d) => d.score));
    const ties = domains.filter((d) => d.score <= lowest + 3);
    if (ties.length > 1) {
      priority = ties.sort(
        (a, b) => priorityOrder.indexOf(a.key) - priorityOrder.indexOf(b.key)
      )[0];
    }
  }

  return { overall, domains, priority };
}

// ─── DIRECTIVES LIBRARY ────────────────────────────────────────────
const DIRECTIVES = {
  glucose: [
    { title: "Pair carbohydrates with protein and fiber at every meal", freq: "7 days", why: "Slows glucose absorption, preventing spikes that drive energy crashes and long-term insulin resistance." },
    { title: "Walk 10 minutes after your largest meal", freq: "5 of 7 days", why: "Post-meal movement clears glucose from the bloodstream, reducing peak glucose by up to 30%." },
    { title: "Replace one refined carbohydrate per day with a fiber-rich alternative", freq: "7 days", why: "Reduces glycemic load, stabilizing energy and reducing pancreatic strain over time." },
  ],
  inflammation: [
    { title: "Establish a consistent bedtime within a 30-minute window", freq: "5 of 7 nights", why: "Sleep consistency reduces inflammatory markers more effectively than sleep duration alone." },
    { title: "Include vegetables at two meals daily", freq: "14 servings this week", why: "Phytonutrients and antioxidants directly lower oxidative stress and systemic inflammation." },
    { title: "Implement a 10-minute wind-down routine before sleep", freq: "5 of 7 nights", why: "Structured decompression lowers cortisol, the primary driver of chronic inflammation." },
  ],
  liver: [
    { title: "Reduce ultra-processed food intake to twice this week or less", freq: "Maximum 2 servings", why: "Ultra-processed foods drive hepatic fat synthesis and liver enzyme elevation." },
    { title: "Eliminate sugary beverages completely", freq: "7 days", why: "Fructose in liquid form bypasses satiety signals and directly stresses liver metabolism." },
    { title: "Walk 20 minutes at moderate pace", freq: "4 of 7 days", why: "Aerobic movement supports hepatic fat oxidation and improves liver enzyme profiles." },
  ],
  bodyComp: [
    { title: "Measure and record your waist circumference", freq: "Once this week", why: "Waist measurement is the single most actionable metabolic risk indicator, more predictive than weight." },
    { title: "Add 2 servings of vegetables to your largest meal", freq: "7 days", why: "Increases satiety through volume and fiber, supporting sustainable composition change." },
    { title: "Complete two 15-minute resistance sessions", freq: "2 sessions this week", why: "Resistance training builds metabolically active tissue that improves resting metabolic rate." },
  ],
  activity: [
    { title: "Accumulate 8,000 steps daily", freq: "5 of 7 days", why: "Non-exercise activity thermogenesis is the largest modifiable component of daily energy expenditure." },
    { title: "Complete one structured resistance training session", freq: "1 session this week", why: "Even minimal resistance work preserves muscle mass critical for metabolic function." },
    { title: "Take a 5-minute movement break every 2 hours during work", freq: "3–5 breaks daily", why: "Breaking prolonged sitting restores insulin sensitivity and improves glucose clearance." },
  ],
};

// ─── PROTOCOL DATA ─────────────────────────────────────────────────
const PROTOCOLS = {
  glucose: {
    title: "Glucose Stabilization Protocol",
    weeks: [
      { week: 1, goal: "Establish glucose-aware eating patterns", meals: ["Pair every carbohydrate with protein or healthy fat", "Eat protein within 60 minutes of waking", "No isolated carbohydrate snacking"], actions: ["10-min post-meal walk after largest meal", "Log energy levels 1hr after each meal"], track: ["Post-meal energy stability (1–5)", "Daily carb-protein pairing adherence"] },
      { week: 2, goal: "Reduce glycemic variability", meals: ["Replace refined grains with intact grains at 2 meals", "Add leafy greens to lunch and dinner", "Limit fruit juice; eat whole fruit instead"], actions: ["Extend post-meal walk to 15 minutes", "Introduce 1 tablespoon apple cider vinegar before meals"], track: ["Cravings frequency (daily count)", "Afternoon energy crash occurrence"] },
      { week: 3, goal: "Optimize meal timing and composition", meals: ["Consolidate eating within 10–12 hour window", "Largest meal at midday when insulin sensitivity peaks", "Evening meal lighter, fiber-focused"], actions: ["No food 3 hours before sleep", "Add resistance movement 2x this week"], track: ["Eating window adherence", "Sleep quality self-rating"] },
      { week: 4, goal: "Consolidate and assess improvement", meals: ["Maintain all Week 1–3 rules", "Introduce one new vegetable variety daily", "Experiment with legume-based meals 3x this week"], actions: ["Re-take metabolic assessment", "Document energy pattern changes"], track: ["Overall energy stability trend", "Weight and waist measurement change"] },
    ],
  },
  inflammation: {
    title: "Inflammation Reset Protocol",
    weeks: [
      { week: 1, goal: "Establish recovery foundations", meals: ["Two servings of fatty fish this week", "Colorful vegetables at every meal", "Eliminate added sugar for 7 days"], actions: ["Set consistent bedtime (±30 min)", "10-min wind-down routine nightly"], track: ["Sleep consistency (bedtime variance)", "Brain fog episodes (daily count)"] },
      { week: 2, goal: "Deepen anti-inflammatory nutrition", meals: ["30 different plant foods this week", "Daily fermented food serving", "Turmeric or ginger in one meal daily"], actions: ["Add 20 min gentle movement daily", "Practice 5-min breathing exercise before bed"], track: ["Plant food variety count", "Joint stiffness rating (1–5)"] },
      { week: 3, goal: "Stress and cortisol management", meals: ["Maintain anti-inflammatory food patterns", "Add magnesium-rich foods daily", "Green tea replacing afternoon coffee"], actions: ["Structured stress management 10 min daily", "No screens 60 min before bed"], track: ["Subjective stress rating", "Sleep quality improvement"] },
      { week: 4, goal: "Consolidate and measure progress", meals: ["Sustain all protocol patterns", "Omega-3 rich meals 3x this week", "Reduce omega-6 cooking oils"], actions: ["Re-take metabolic assessment", "Document recovery pattern changes"], track: ["Overall inflammation symptom trend", "Energy and focus improvement"] },
    ],
  },
  liver: {
    title: "Liver Load Reduction Protocol",
    weeks: [
      { week: 1, goal: "Reduce hepatic processing burden", meals: ["Zero sugary beverages for 7 days", "Maximum 2 ultra-processed meals this week", "Add cruciferous vegetables 4x this week"], actions: ["20-min walk 4 days this week", "Log all alcohol consumption"], track: ["Sugary drink adherence (days clean)", "Processed food frequency"] },
      { week: 2, goal: "Support liver detoxification pathways", meals: ["Daily serving of leafy greens", "Eggs or legumes for choline 4x this week", "Garlic and onion in cooking daily"], actions: ["Increase walking to 25 min, 5 days", "Reduce alcohol by 50% from baseline"], track: ["Vegetable intake consistency", "Bloating frequency and severity"] },
      { week: 3, goal: "Optimize fat metabolism support", meals: ["Fatty fish 2x this week", "Coffee (if tolerated) daily for liver support", "Reduce fried food to maximum 1x this week"], actions: ["Add 1 resistance session this week", "Increase daily water intake to 8 glasses"], track: ["Abdominal comfort rating", "Energy level improvement"] },
      { week: 4, goal: "Assess and consolidate liver patterns", meals: ["Maintain all protocol patterns", "Fiber intake target: 30g daily", "Minimal alcohol this week"], actions: ["Re-take metabolic assessment", "Note digestive pattern changes"], track: ["Overall digestive comfort trend", "Waist measurement change"] },
    ],
  },
  bodyComp: {
    title: "Body Composition Protocol",
    weeks: [
      { week: 1, goal: "Establish measurement and nutrition baseline", meals: ["Protein at every meal (palm-sized portion)", "2 extra vegetable servings at largest meal", "Reduce liquid calories by 50%"], actions: ["Measure waist circumference", "Two 15-min resistance sessions", "Daily 7,000 step target"], track: ["Waist measurement", "Resistance session completion"] },
      { week: 2, goal: "Build metabolically active tissue", meals: ["Increase protein to 1.2g per kg bodyweight", "Replace one starch with legumes daily", "Structured meal timing (3 meals, no grazing)"], actions: ["Three 15-min resistance sessions", "8,000 daily step target"], track: ["Protein intake adherence", "Step count average"] },
      { week: 3, goal: "Optimize body composition signals", meals: ["Maintain protein targets", "Add healthy fats at each meal", "10-hour eating window"], actions: ["Two 20-min resistance sessions", "One longer walk (30+ min)"], track: ["Eating window adherence", "Strength progression notes"] },
      { week: 4, goal: "Measure and consolidate progress", meals: ["Sustain all protocol patterns", "Increase vegetable diversity", "Mindful eating at all meals"], actions: ["Re-measure waist circumference", "Re-take metabolic assessment"], track: ["Waist measurement change", "Overall composition trend"] },
    ],
  },
  activity: {
    title: "Activity Resilience Protocol",
    weeks: [
      { week: 1, goal: "Establish movement baseline", meals: ["Pre-activity nutrition: light protein + carb", "Post-activity: protein within 45 min", "Hydration target: 8+ glasses daily"], actions: ["8,000 steps daily for 5 days", "One resistance session", "Movement break every 2 hours at work"], track: ["Daily step count", "Seated time breaks taken"] },
      { week: 2, goal: "Build structured activity habit", meals: ["Maintain activity nutrition", "Add anti-inflammatory foods on training days", "Adequate sleep (7+ hours) on training nights"], actions: ["Two resistance sessions", "One 20-min moderate cardio", "10,000 step target 3 days"], track: ["Session completion rate", "Recovery quality rating"] },
      { week: 3, goal: "Progress and recover effectively", meals: ["Protein timing around workouts", "Tart cherry or beetroot for recovery", "Magnesium-rich evening meal on training days"], actions: ["Two resistance + two cardio sessions", "Active recovery day (yoga, walking)"], track: ["Performance progression", "Soreness and recovery duration"] },
      { week: 4, goal: "Consolidate activity resilience", meals: ["Sustain performance nutrition", "Week of intuitive eating with activity support", "Celebrate consistency with a quality meal"], actions: ["Maintain Week 3 activity level", "Re-take metabolic assessment"], track: ["Fitness improvement markers", "Metabolic score change"] },
    ],
  },
};

// ─── QUESTIONS ──────────────────────────────────────────────────────
const SECTIONS = [
  {
    title: "Body Composition",
    subtitle: "Understanding your physical baseline",
    questions: [
      { id: "age", text: "What is your age range?", options: [["under35", "Under 35"], ["35to44", "35–44"], ["45to54", "45–54"], ["55to64", "55–64"], ["65plus", "65+"]] },
      { id: "height", text: "Your height in centimeters", type: "number", placeholder: "e.g. 170" },
      { id: "waist", text: "Waist circumference in centimeters", type: "number", placeholder: "e.g. 85 (measure at navel)", note: "If unknown, enter 0" },
      { id: "weightTrend", text: "Weight trend in the past 12 months?", options: [["stable", "Stable"], ["gradual", "Gradually increased"], ["significant", "Significantly increased"], ["decreased", "Decreased"]] },
      { id: "fatStorage", text: "Where do you tend to carry excess weight?", options: [["abdomen", "Abdomen"], ["hips", "Hips and thighs"], ["even", "Evenly distributed"], ["na", "Not applicable"]] },
      { id: "weightDiff", text: "Difficulty losing weight in the past 5 years?", options: [["no", "No difficulty"], ["moderate", "Moderate difficulty"], ["significant", "Significant difficulty"]] },
    ],
  },
  {
    title: "Glucose Stability",
    subtitle: "How your body manages energy",
    questions: [
      { id: "energyAfterMeal", text: "Energy level 1–2 hours after meals?", options: [["stable", "Stable energy"], ["slight", "Slight dip"], ["noticeable", "Noticeable crash"], ["severe", "Severe crash"]] },
      { id: "cravings", text: "How often do you experience sugar or carb cravings?", options: [["rarely", "Rarely"], ["occasionally", "Occasionally"], ["frequently", "Frequently"], ["daily", "Daily"]] },
      { id: "delayedMeal", text: "What happens when you delay a meal?", options: [["mild", "Mild hunger"], ["irritable", "Become irritable"], ["shaky", "Shaky or dizzy"], ["avoid", "I avoid delaying meals"]] },
      { id: "trembling", text: "Trembling or sweating that resolves with eating?", options: [["never", "Never"], ["rarely", "Rarely"], ["occasionally", "Occasionally"], ["frequently", "Frequently"]] },
      { id: "diabetesHistory", text: "Have you ever been told you have:", options: [["none", "None of these"], ["prediabetes", "Pre-diabetes"], ["gestational", "Gestational diabetes"], ["type2", "Type 2 diabetes"]] },
    ],
  },
  {
    title: "Liver Load Pattern",
    subtitle: "Dietary burden on metabolic processing",
    questions: [
      { id: "sugaryDrinks", text: "How often do you consume sugary beverages?", options: [["rarely", "Rarely or never"], ["1to3", "1–3 times per week"], ["4to6", "4–6 times per week"], ["daily", "Daily"]] },
      { id: "processedFood", text: "Ultra-processed or fast food frequency?", options: [["rarely", "Rarely"], ["1to2", "1–2 times per week"], ["3to4", "3–4 times per week"], ["5plus", "5 or more per week"]] },
      { id: "addedSugar", text: "Added sugar in foods or drinks?", options: [["rarely", "Rarely"], ["1to3", "1–3 times per week"], ["4to6", "4–6 times per week"], ["daily", "Daily"]] },
      { id: "alcohol", text: "Alcohol consumption pattern?", options: [["none", "None"], ["moderate", "Moderate (1–2 drinks, few times/week)"], ["regular", "Regular (most days)"], ["high", "High (daily, multiple)"]] },
      { id: "overfull", text: "How often do you eat until uncomfortably full?", options: [["rarely", "Rarely"], ["occasionally", "Occasionally"], ["frequently", "Frequently"], ["most", "Most days"]] },
    ],
  },
  {
    title: "Inflammation & Recovery",
    subtitle: "Sleep, stress, and systemic recovery",
    questions: [
      { id: "sleepHours", text: "Average hours of sleep per night?", options: [["7to9", "7–9 hours"], ["6to7", "6–7 hours"], ["5to6", "5–6 hours"], ["under5", "Under 5 hours"]] },
      { id: "sleepConsistency", text: "How consistent is your sleep schedule?", options: [["very", "Very consistent"], ["moderate", "Moderately consistent"], ["somewhat", "Somewhat inconsistent"], ["highly", "Highly inconsistent"]] },
      { id: "wakeRested", text: "Do you wake up feeling rested?", options: [["most", "Most days"], ["sometimes", "Sometimes"], ["rarely", "Rarely"], ["never", "Never"]] },
      { id: "stress", text: "Stress level in the past month?", options: [["low", "Low"], ["moderate", "Moderate"], ["high", "High"], ["vhigh", "Very high"]] },
      { id: "brainFog", text: "Frequency of brain fog or poor concentration?", options: [["rarely", "Rarely"], ["occasionally", "Occasionally"], ["frequently", "Frequently"], ["daily", "Daily"]] },
    ],
  },
  {
    title: "Activity Resilience",
    subtitle: "Movement patterns and physical capacity",
    questions: [
      { id: "exerciseMin", text: "Structured exercise minutes per week?", options: [["150plus", "150+ minutes"], ["75to149", "75–149 minutes"], ["30to74", "30–74 minutes"], ["under30", "Under 30 minutes"]] },
      { id: "dailyMovement", text: "Daily movement level outside exercise?", options: [["highly", "Highly active"], ["moderate", "Moderately active"], ["mostly", "Mostly sedentary"], ["fully", "Fully sedentary"]] },
      { id: "resistance", text: "Resistance or strength training?", options: [["2plus", "2+ times per week"], ["1week", "Once per week"], ["occasional", "Occasionally"], ["never", "Never"]] },
      { id: "recovery", text: "Recovery after physical exertion?", options: [["quick", "Quick recovery"], ["moderate", "Moderate recovery"], ["slow", "Slow or difficult"], ["na", "Not applicable"]] },
    ],
  },
];

// ─── APP COMPONENT ─────────────────────────────────────────────────
export default function DietMe() {
  const [screen, setScreen] = useState("landing");
  const [answers, setAnswers] = useState({});
  const [sectionIdx, setSectionIdx] = useState(0);
  const [results, setResults] = useState(null);
  const [isPremium, setIsPremium] = useState(false);
  const [showProtocol, setShowProtocol] = useState(false);
  const [protocolWeek, setProtocolWeek] = useState(0);
  const [animateIn, setAnimateIn] = useState(true);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const topRef = useRef(null);

  useEffect(() => {
    setAnimateIn(true);
  }, [screen, sectionIdx]);

  const transition = (fn) => {
    setAnimateIn(false);
    setTimeout(() => {
      fn();
      topRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 250);
  };

  const totalQ = SECTIONS.reduce((s, sec) => s + sec.questions.length, 0);
  const answeredQ = Object.keys(answers).length;

  const allSectionAnswered = () => {
    const sec = SECTIONS[sectionIdx];
    return sec.questions.every(
      (q) => answers[q.id] !== undefined && answers[q.id] !== ""
    );
  };

  const handleAnswer = (id, val) => {
    setAnswers((prev) => ({ ...prev, [id]: val }));
  };

  const handleSubmit = () => {
    const res = computeScores(answers);
    setResults(res);
    transition(() => setScreen("results"));
  };

  // ─── LANDING ───────────────────────────────────────────────────
  if (screen === "landing") {
    return (
      <div ref={topRef} style={{ minHeight: "100vh", background: "#0A1628", color: "#E8ECF1", fontFamily: "'Instrument Serif', 'Georgia', serif" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap');
          * { box-sizing: border-box; margin: 0; padding: 0; }
          .dm-sans { font-family: 'DM Sans', sans-serif; }
          .instrument { font-family: 'Instrument Serif', Georgia, serif; }
          @keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes pulse-ring { 0% { transform: scale(0.9); opacity: 0.5; } 50% { transform: scale(1.1); opacity: 0.2; } 100% { transform: scale(0.9); opacity: 0.5; } }
          .fade-up { animation: fadeUp 0.7s ease-out forwards; }
          .fade-up-2 { animation: fadeUp 0.7s ease-out 0.15s forwards; opacity: 0; }
          .fade-up-3 { animation: fadeUp 0.7s ease-out 0.3s forwards; opacity: 0; }
          .fade-up-4 { animation: fadeUp 0.7s ease-out 0.45s forwards; opacity: 0; }
          .anim-out { opacity: 0; transform: translateY(-12px); transition: all 0.25s ease; }
          .anim-in { opacity: 1; transform: translateY(0); transition: all 0.4s ease; }
        `}</style>

        {/* Nav */}
        <nav className="dm-sans" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "24px 32px", maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg, #2D6A4F, #40916C)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#fff", fontSize: 16, fontWeight: 700 }}>D</span>
            </div>
            <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em" }}>DietMe</span>
          </div>
          <div style={{ display: "flex", gap: 24, alignItems: "center", fontSize: 14, color: "#8896AB" }}>
            <span style={{ cursor: "pointer" }}>About</span>
            <span style={{ cursor: "pointer" }}>Science</span>
            <button onClick={() => transition(() => setScreen("assess"))} className="dm-sans" style={{ background: "#2D6A4F", color: "#fff", border: "none", padding: "10px 24px", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Begin Assessment</button>
          </div>
        </nav>

        {/* Hero */}
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "80px 32px 60px" }}>
          <div className="fade-up" style={{ display: "inline-block", background: "rgba(45,106,79,0.15)", border: "1px solid rgba(45,106,79,0.3)", borderRadius: 100, padding: "6px 18px", fontSize: 13, color: "#52B788", marginBottom: 32, fontFamily: "'DM Sans', sans-serif" }}>
            Metabolic Clarity Platform
          </div>

          <h1 className="fade-up-2 instrument" style={{ fontSize: "clamp(40px, 7vw, 80px)", lineHeight: 1.05, fontWeight: 400, maxWidth: 800, marginBottom: 28 }}>
            Know your metabolic<br />
            <span style={{ color: "#52B788" }}>stability</span> before<br />
            symptoms speak.
          </h1>

          <p className="fade-up-3 dm-sans" style={{ fontSize: 18, lineHeight: 1.7, color: "#8896AB", maxWidth: 540, marginBottom: 48 }}>
            A structured 25-question assessment that translates lifestyle patterns into a clear metabolic stability score. No guesswork. No hype. Evidence-informed clarity for adults who take their health seriously.
          </p>

          <div className="fade-up-4" style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <button onClick={() => transition(() => setScreen("assess"))} className="dm-sans" style={{ background: "#2D6A4F", color: "#fff", border: "none", padding: "16px 40px", borderRadius: 10, fontSize: 16, fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}>
              Start Your Assessment →
            </button>
            <button className="dm-sans" style={{ background: "transparent", color: "#8896AB", border: "1px solid #2A3547", padding: "16px 32px", borderRadius: 10, fontSize: 16, fontWeight: 500, cursor: "pointer" }}>
              How It Works
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="dm-sans fade-up-4" style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px 60px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 1, background: "#1A2540", borderRadius: 16, overflow: "hidden", border: "1px solid #1F2D45" }}>
            {[
              ["25", "Structured Questions"],
              ["5", "Health Domains"],
              ["0–100", "Clarity Score"],
              ["35+", "Adult-Focused"],
            ].map(([num, label], i) => (
              <div key={i} style={{ padding: "28px 24px", textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: "#52B788", marginBottom: 6 }}>{num}</div>
                <div style={{ fontSize: 13, color: "#6B7A90" }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* How it works */}
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 32px 80px" }}>
          <h2 className="instrument" style={{ fontSize: 36, marginBottom: 48, textAlign: "center" }}>How DietMe works</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 24 }}>
            {[
              { step: "01", title: "Complete Assessment", desc: "Answer 25 evidence-based questions across 5 metabolic domains. Takes approximately 8 minutes." },
              { step: "02", title: "Receive Your Score", desc: "Get a Metabolic Stability Score (0–100) with domain-level breakdowns revealing exactly where instability exists." },
              { step: "03", title: "Follow Your Protocol", desc: "Receive personalized directives and a structured 4-week protocol targeting your weakest metabolic domain." },
            ].map((item, i) => (
              <div key={i} style={{ background: "#111D33", border: "1px solid #1F2D45", borderRadius: 16, padding: 32 }}>
                <div className="dm-sans" style={{ color: "#2D6A4F", fontSize: 14, fontWeight: 700, marginBottom: 16 }}>{item.step}</div>
                <h3 className="instrument" style={{ fontSize: 22, marginBottom: 12 }}>{item.title}</h3>
                <p className="dm-sans" style={{ fontSize: 14, lineHeight: 1.7, color: "#6B7A90" }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Domains preview */}
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px 100px" }}>
          <h2 className="instrument" style={{ fontSize: 36, marginBottom: 16, textAlign: "center" }}>Five domains of metabolic stability</h2>
          <p className="dm-sans" style={{ textAlign: "center", color: "#6B7A90", fontSize: 15, marginBottom: 48, maxWidth: 600, margin: "0 auto 48px" }}>Each domain represents a critical dimension of metabolic health. Your score reveals which domain needs immediate attention.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            {[
              { icon: "◉", name: "Body Composition", desc: "Structural metabolic load" },
              { icon: "◈", name: "Glucose Stability", desc: "Energy and blood sugar regulation" },
              { icon: "◆", name: "Liver Load", desc: "Dietary processing burden" },
              { icon: "◇", name: "Inflammation", desc: "Recovery and repair capacity" },
              { icon: "△", name: "Activity Resilience", desc: "Movement and physical reserve" },
            ].map((d, i) => (
              <div key={i} style={{ background: "#111D33", border: "1px solid #1F2D45", borderRadius: 14, padding: 24, textAlign: "center" }}>
                <div style={{ fontSize: 32, marginBottom: 12, color: "#52B788" }}>{d.icon}</div>
                <div className="dm-sans" style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>{d.name}</div>
                <div className="dm-sans" style={{ fontSize: 13, color: "#6B7A90" }}>{d.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="dm-sans" style={{ borderTop: "1px solid #1F2D45", padding: "32px", textAlign: "center", fontSize: 13, color: "#4A5568" }}>
          DietMe provides lifestyle-based metabolic stability insights. It does not diagnose or treat medical conditions.
        </div>
      </div>
    );
  }

  // ─── ASSESSMENT ────────────────────────────────────────────────
  if (screen === "assess") {
    const section = SECTIONS[sectionIdx];
    const progress = ((sectionIdx) / SECTIONS.length) * 100;

    return (
      <div ref={topRef} style={{ minHeight: "100vh", background: "#0A1628", color: "#E8ECF1", fontFamily: "'DM Sans', sans-serif" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap');
          * { box-sizing: border-box; margin: 0; padding: 0; }
          .dm-sans { font-family: 'DM Sans', sans-serif; }
          .instrument { font-family: 'Instrument Serif', Georgia, serif; }
          @keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
          .anim-in { animation: fadeUp 0.4s ease-out forwards; }
          .anim-out { opacity: 0; transform: translateY(-12px); transition: all 0.2s; }
        `}</style>

        {/* Header */}
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 24px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <button onClick={() => transition(() => sectionIdx > 0 ? setSectionIdx(sectionIdx - 1) : setScreen("landing"))} style={{ background: "none", border: "none", color: "#6B7A90", cursor: "pointer", fontSize: 14 }}>← Back</button>
            <span style={{ fontSize: 13, color: "#4A5568" }}>{answeredQ} of {totalQ} answered</span>
          </div>
          {/* Progress */}
          <div style={{ height: 3, background: "#1A2540", borderRadius: 2, marginBottom: 8 }}>
            <div style={{ height: 3, background: "linear-gradient(90deg, #2D6A4F, #52B788)", borderRadius: 2, width: `${Math.max(5, ((sectionIdx + 1) / SECTIONS.length) * 100)}%`, transition: "width 0.5s ease" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#4A5568", marginBottom: 40 }}>
            <span>Section {sectionIdx + 1} of {SECTIONS.length}</span>
            <span>{section.title}</span>
          </div>
        </div>

        {/* Section */}
        <div className={animateIn ? "anim-in" : "anim-out"} style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px 60px" }}>
          <div style={{ marginBottom: 40 }}>
            <h2 className="instrument" style={{ fontSize: 32, marginBottom: 8 }}>{section.title}</h2>
            <p style={{ color: "#6B7A90", fontSize: 15 }}>{section.subtitle}</p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            {section.questions.map((q) => (
              <div key={q.id} style={{ background: "#111D33", border: "1px solid #1F2D45", borderRadius: 14, padding: 24 }}>
                <label style={{ display: "block", fontSize: 15, fontWeight: 500, marginBottom: 16, lineHeight: 1.5 }}>{q.text}</label>

                {q.type === "number" ? (
                  <div>
                    <input
                      type="number"
                      placeholder={q.placeholder}
                      value={answers[q.id] || ""}
                      onChange={(e) => handleAnswer(q.id, e.target.value)}
                      style={{ width: "100%", padding: "12px 16px", background: "#0A1628", border: "1px solid #2A3547", borderRadius: 8, color: "#E8ECF1", fontSize: 16, outline: "none" }}
                    />
                    {q.note && <div style={{ fontSize: 12, color: "#4A5568", marginTop: 8 }}>{q.note}</div>}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {q.options.map(([val, label]) => {
                      const sel = answers[q.id] === val;
                      return (
                        <button
                          key={val}
                          onClick={() => handleAnswer(q.id, val)}
                          style={{
                            padding: "12px 16px",
                            background: sel ? "rgba(45,106,79,0.15)" : "#0A1628",
                            border: sel ? "1px solid #2D6A4F" : "1px solid #1F2D45",
                            borderRadius: 8,
                            color: sel ? "#52B788" : "#8896AB",
                            fontSize: 14,
                            textAlign: "left",
                            cursor: "pointer",
                            transition: "all 0.15s",
                            fontWeight: sel ? 600 : 400,
                            fontFamily: "'DM Sans', sans-serif",
                          }}
                        >
                          {sel ? "● " : "○ "}{label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Navigation */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 40, gap: 16 }}>
            {sectionIdx > 0 && (
              <button onClick={() => transition(() => setSectionIdx(sectionIdx - 1))} style={{ flex: 1, padding: "14px 24px", background: "transparent", border: "1px solid #2A3547", borderRadius: 10, color: "#8896AB", fontSize: 15, fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                ← Previous
              </button>
            )}
            {sectionIdx < SECTIONS.length - 1 ? (
              <button
                onClick={() => allSectionAnswered() && transition(() => setSectionIdx(sectionIdx + 1))}
                disabled={!allSectionAnswered()}
                style={{
                  flex: 1, padding: "14px 24px",
                  background: allSectionAnswered() ? "#2D6A4F" : "#1A2540",
                  border: "none", borderRadius: 10,
                  color: allSectionAnswered() ? "#fff" : "#4A5568",
                  fontSize: 15, fontWeight: 600, cursor: allSectionAnswered() ? "pointer" : "not-allowed",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Continue →
              </button>
            ) : (
              <button
                onClick={() => allSectionAnswered() && handleSubmit()}
                disabled={!allSectionAnswered()}
                style={{
                  flex: 1, padding: "14px 24px",
                  background: allSectionAnswered() ? "linear-gradient(135deg, #2D6A4F, #1B4332)" : "#1A2540",
                  border: "none", borderRadius: 10,
                  color: allSectionAnswered() ? "#fff" : "#4A5568",
                  fontSize: 15, fontWeight: 600, cursor: allSectionAnswered() ? "pointer" : "not-allowed",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Calculate My Score →
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── RESULTS ───────────────────────────────────────────────────
  if (screen === "results" && results) {
    const band = getBand(results.overall);
    const pri = results.priority;
    const dirs = DIRECTIVES[pri.key] || DIRECTIVES.glucose;
    const protocol = PROTOCOLS[pri.key] || PROTOCOLS.glucose;
    const week = protocol.weeks[protocolWeek];

    const interp = results.overall >= 80
      ? "Your metabolic profile shows strong stability across all domains. Maintain current patterns."
      : results.overall >= 65
      ? `Your profile indicates mild instability, driven primarily by ${pri.label.toLowerCase()}. Targeted adjustments can restore balance.`
      : results.overall >= 50
      ? `Your profile reveals an elevated instability pattern centered on ${pri.label.toLowerCase()}. Structured intervention is recommended.`
      : `Your profile shows significant metabolic instability, particularly in ${pri.label.toLowerCase()}. Immediate protocol adherence is strongly advised.`;

    return (
      <div ref={topRef} style={{ minHeight: "100vh", background: "#0A1628", color: "#E8ECF1", fontFamily: "'DM Sans', sans-serif" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap');
          * { box-sizing: border-box; margin: 0; padding: 0; }
          .dm-sans { font-family: 'DM Sans', sans-serif; }
          .instrument { font-family: 'Instrument Serif', Georgia, serif; }
          @keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes countUp { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
          @keyframes barGrow { from { width: 0%; } }
          .fade-up { animation: fadeUp 0.6s ease-out forwards; }
          .fade-d1 { animation: fadeUp 0.6s ease-out 0.1s forwards; opacity: 0; }
          .fade-d2 { animation: fadeUp 0.6s ease-out 0.2s forwards; opacity: 0; }
          .fade-d3 { animation: fadeUp 0.6s ease-out 0.35s forwards; opacity: 0; }
          .fade-d4 { animation: fadeUp 0.6s ease-out 0.5s forwards; opacity: 0; }
          .fade-d5 { animation: fadeUp 0.6s ease-out 0.65s forwards; opacity: 0; }
          .score-pop { animation: countUp 0.8s ease-out 0.3s forwards; opacity: 0; }
          .bar-anim { animation: barGrow 1s ease-out forwards; }
        `}</style>

        <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px 80px" }}>

          {/* Header */}
          <div className="fade-up" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 48 }}>
            <div>
              <div style={{ fontSize: 13, color: "#4A5568", marginBottom: 4 }}>Metabolic Stability Assessment</div>
              <div style={{ fontSize: 13, color: "#6B7A90" }}>{new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</div>
            </div>
            <button onClick={() => { setScreen("landing"); setAnswers({}); setSectionIdx(0); setResults(null); setShowProtocol(false); setProtocolWeek(0); }} style={{ background: "none", border: "1px solid #2A3547", borderRadius: 8, color: "#6B7A90", padding: "8px 16px", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
              New Assessment
            </button>
          </div>

          {/* Score Card */}
          <div className="fade-d1" style={{ background: "linear-gradient(135deg, #111D33, #162036)", border: "1px solid #1F2D45", borderRadius: 20, padding: "48px 32px", textAlign: "center", marginBottom: 32, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200, borderRadius: "50%", background: `${band.color}10`, filter: "blur(60px)" }} />
            <div style={{ fontSize: 13, color: "#6B7A90", textTransform: "uppercase", letterSpacing: 2, marginBottom: 16 }}>Overall Metabolic Stability</div>
            <div className="score-pop" style={{ fontSize: 96, fontWeight: 700, color: band.color, lineHeight: 1, marginBottom: 12, fontFamily: "'Instrument Serif', Georgia, serif" }}>
              {results.overall}
            </div>
            <div style={{ display: "inline-block", background: `${band.color}20`, border: `1px solid ${band.color}40`, borderRadius: 100, padding: "6px 20px", fontSize: 14, color: band.color, fontWeight: 600, marginBottom: 24 }}>
              {band.label}
            </div>
            <p style={{ fontSize: 16, lineHeight: 1.7, color: "#8896AB", maxWidth: 540, margin: "0 auto" }}>{interp}</p>
          </div>

          {/* Domain Subscores */}
          <div className="fade-d2" style={{ background: "#111D33", border: "1px solid #1F2D45", borderRadius: 16, padding: 28, marginBottom: 32 }}>
            <h3 className="instrument" style={{ fontSize: 22, marginBottom: 24 }}>Domain Breakdown</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {results.domains.map((d, i) => {
                const db = getBand(d.score);
                const isPri = d.key === pri.key;
                return (
                  <div key={d.key}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 18, color: isPri ? "#52B788" : "#4A5568" }}>{d.icon}</span>
                        <span style={{ fontSize: 14, fontWeight: isPri ? 600 : 400, color: isPri ? "#E8ECF1" : "#8896AB" }}>{d.label}</span>
                        {isPri && <span style={{ fontSize: 10, background: "#2D6A4F", color: "#fff", padding: "2px 8px", borderRadius: 4, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Priority</span>}
                      </div>
                      <span style={{ fontSize: 16, fontWeight: 700, color: db.color }}>{d.score}</span>
                    </div>
                    <div style={{ height: 8, background: "#1A2540", borderRadius: 4, overflow: "hidden" }}>
                      <div className="bar-anim" style={{ height: 8, background: `linear-gradient(90deg, ${db.color}CC, ${db.color})`, borderRadius: 4, width: `${d.score}%`, animationDelay: `${0.3 + i * 0.15}s` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Priority Focus Area */}
          <div className="fade-d3" style={{ background: "linear-gradient(135deg, rgba(45,106,79,0.1), rgba(45,106,79,0.05))", border: "1px solid rgba(45,106,79,0.3)", borderRadius: 16, padding: 28, marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(45,106,79,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "#52B788" }}>{pri.icon}</div>
              <div>
                <div style={{ fontSize: 12, color: "#52B788", textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 600 }}>Priority Focus Area</div>
                <div className="instrument" style={{ fontSize: 22 }}>{pri.label}</div>
              </div>
            </div>
            <p style={{ fontSize: 14, color: "#8896AB", lineHeight: 1.7 }}>
              This domain scored {pri.score}/100, indicating the area with greatest opportunity for metabolic improvement. The directives below target this domain specifically.
            </p>
          </div>

          {/* Directives */}
          <div className="fade-d4" style={{ marginBottom: 32 }}>
            <h3 className="instrument" style={{ fontSize: 22, marginBottom: 20 }}>Your Personalized Directives</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {dirs.map((d, i) => {
                const locked = !isPremium && i > 0;
                return (
                  <div key={i} style={{ background: locked ? "#0E1A2E" : "#111D33", border: `1px solid ${locked ? "#15203A" : "#1F2D45"}`, borderRadius: 14, padding: 24, position: "relative", overflow: "hidden" }}>
                    {locked && (
                      <div style={{ position: "absolute", inset: 0, background: "rgba(10,22,40,0.8)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 }}>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 24, marginBottom: 8 }}>🔒</div>
                          <div style={{ fontSize: 13, color: "#6B7A90" }}>Premium directive</div>
                        </div>
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                      <div style={{ fontSize: 12, color: "#2D6A4F", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Directive {i + 1}</div>
                      <div style={{ fontSize: 12, color: "#52B788", background: "rgba(45,106,79,0.15)", padding: "3px 10px", borderRadius: 4 }}>{d.freq}</div>
                    </div>
                    <h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 10, lineHeight: 1.5 }}>{d.title}</h4>
                    <p style={{ fontSize: 13, color: "#6B7A90", lineHeight: 1.6 }}><span style={{ color: "#52B788", fontWeight: 600 }}>Why:</span> {d.why}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Upgrade / Protocol Buttons */}
          <div className="fade-d5">
            {!isPremium ? (
              <div style={{ background: "linear-gradient(135deg, #162036, #1A2844)", border: "1px solid #2A3547", borderRadius: 16, padding: 32, textAlign: "center", marginBottom: 32 }}>
                <h3 className="instrument" style={{ fontSize: 24, marginBottom: 12 }}>Unlock Full Metabolic Intelligence</h3>
                <p style={{ fontSize: 14, color: "#6B7A90", marginBottom: 24, maxWidth: 480, margin: "0 auto 24px" }}>
                  Get all 3 directives, structured 4-week protocols, weekly tracking, and executive summary export.
                </p>
                <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
                  <button onClick={() => setIsPremium(true)} style={{ background: "linear-gradient(135deg, #2D6A4F, #1B4332)", color: "#fff", border: "none", padding: "14px 36px", borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                    Upgrade — $29/month
                  </button>
                  <button onClick={() => { setShowProtocol(false); setScreen("landing"); setAnswers({}); setSectionIdx(0); setResults(null); }} style={{ background: "none", border: "1px solid #2A3547", color: "#6B7A90", padding: "14px 24px", borderRadius: 10, fontSize: 15, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                    Maybe later
                  </button>
                </div>
              </div>
            ) : !showProtocol ? (
              <button onClick={() => setShowProtocol(true)} style={{ width: "100%", background: "linear-gradient(135deg, #2D6A4F, #1B4332)", color: "#fff", border: "none", padding: "18px 36px", borderRadius: 12, fontSize: 16, fontWeight: 600, cursor: "pointer", marginBottom: 32, fontFamily: "'DM Sans', sans-serif" }}>
                Start 4-Week Protocol: {protocol.title} →
              </button>
            ) : null}

            {/* Protocol View */}
            {showProtocol && isPremium && (
              <div style={{ background: "#111D33", border: "1px solid #1F2D45", borderRadius: 16, padding: 28, marginBottom: 32 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                  <div>
                    <div style={{ fontSize: 12, color: "#52B788", textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 600, marginBottom: 4 }}>Active Protocol</div>
                    <h3 className="instrument" style={{ fontSize: 22 }}>{protocol.title}</h3>
                  </div>
                  <button onClick={() => setShowProtocol(false)} style={{ background: "none", border: "1px solid #2A3547", borderRadius: 8, color: "#6B7A90", padding: "6px 14px", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Close</button>
                </div>

                {/* Week tabs */}
                <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
                  {protocol.weeks.map((w, i) => (
                    <button key={i} onClick={() => setProtocolWeek(i)} style={{
                      flex: 1, padding: "10px 8px",
                      background: protocolWeek === i ? "rgba(45,106,79,0.2)" : "transparent",
                      border: protocolWeek === i ? "1px solid #2D6A4F" : "1px solid #1F2D45",
                      borderRadius: 8, color: protocolWeek === i ? "#52B788" : "#4A5568",
                      fontSize: 13, fontWeight: protocolWeek === i ? 600 : 400, cursor: "pointer",
                      fontFamily: "'DM Sans', sans-serif",
                    }}>
                      Week {w.week}
                    </button>
                  ))}
                </div>

                {/* Week content */}
                <div style={{ background: "#0E1A2E", borderRadius: 12, padding: 24 }}>
                  <div style={{ fontSize: 12, color: "#52B788", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, fontWeight: 600 }}>Week {week.week} Goal</div>
                  <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 24 }}>{week.goal}</div>

                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 13, color: "#52B788", fontWeight: 600, marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>Meal Rules</div>
                    {week.meals.map((m, i) => (
                      <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, fontSize: 14, color: "#8896AB", lineHeight: 1.5 }}>
                        <span style={{ color: "#2D6A4F", fontWeight: 700, flexShrink: 0 }}>—</span>
                        <span>{m}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 13, color: "#52B788", fontWeight: 600, marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>Daily Actions</div>
                    {week.actions.map((a, i) => (
                      <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, fontSize: 14, color: "#8896AB", lineHeight: 1.5 }}>
                        <span style={{ color: "#2D6A4F", fontWeight: 700, flexShrink: 0 }}>—</span>
                        <span>{a}</span>
                      </div>
                    ))}
                  </div>

                  <div>
                    <div style={{ fontSize: 13, color: "#52B788", fontWeight: 600, marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>Track This Week</div>
                    {week.track.map((t, i) => (
                      <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, fontSize: 14, color: "#8896AB", lineHeight: 1.5 }}>
                        <span style={{ color: "#52B788", flexShrink: 0 }}>◻</span>
                        <span>{t}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Disclaimer */}
          <div style={{ background: "#0E1A2E", border: "1px solid #15203A", borderRadius: 10, padding: 16, textAlign: "center", fontSize: 12, color: "#4A5568", lineHeight: 1.6 }}>
            This assessment provides lifestyle-based metabolic stability insights. It does not diagnose or treat medical conditions. Consult your healthcare provider for medical concerns.
          </div>
        </div>
      </div>
    );
  }

  return null;
}
