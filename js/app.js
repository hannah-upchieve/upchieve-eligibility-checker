const FRL_THRESHOLD = 0.40;

const SUPPORT_EMAIL = "support@upchieve.org";

// UPchieve serves grades 6–12. A school whose highest grade is below this is
// ineligible; one whose highest grade is exactly this is checked as usual but
// gets a note that its younger students aren't covered (unless it has none).
const LOWEST_SERVED_GRADE = 6;

const ICON_ELIGIBLE = `<svg class="result-icon" viewBox="0 0 44 44" fill="none" aria-hidden="true"><circle cx="21.93" cy="22.2" r="19.79" fill="#f2fbf9" stroke="#16d2aa" stroke-width="4"/><path d="m19.6 27.99.75.75m-.75-.75-.75.75m.75-.75c.75.75.75.75.75.75m0 0c-.41.42-1.09.42-1.5 0m1.5 0 10.95-10.95c.42-.42.42-1.09 0-1.51-.41-.41-1.09-.41-1.5 0l-10.2 10.2-4.93-4.93c-.41-.41-1.09-.41-1.5 0-.42.42-.42 1.09 0 1.51l5.68 5.68" stroke="#16d2aa" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></svg>`;

const ICON_NOT_ELIGIBLE = `<svg class="result-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="m8 16c4.4183 0 8-3.5817 8-8 0-4.41828-3.5817-8-8-8-4.41827 0-8 3.58172-8 8 0 4.4183 3.58173 8 8 8zm-.784-10.608c.15198.136.36798.204.64801.204.27198 0 .47998-.068.62397-.204.15203-.144.22802-.344.22802-.6s-.07599-.452-.22802-.588c-.14399-.136-.35199-.204-.62397-.204-.28003 0-.49603.068-.64801.204-.14398.136-.216.332-.216.588s.07202.456.216.6zm1.284 7.212v-6h-1.284v6z" fill="#1855d1"/></svg>`;

const stateButton = document.getElementById("state-button");
const stateValue = document.getElementById("state-value");
const stateList = document.getElementById("state-list");
const searchSection = document.getElementById("search-section");
const searchInput = document.getElementById("school-search");
const resultsList = document.getElementById("results-list");
const resultCard = document.getElementById("result-card");
const statusMessage = document.getElementById("status-message");

let currentSchools = [];
let currentStateName = "";
let currentStateCode = "";

populateStates();

function populateStates() {
  for (const state of STATES) {
    const option = document.createElement("li");
    option.className = "result-item option";
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", "false");
    option.dataset.code = state.code;
    option.tabIndex = -1;
    option.textContent = state.name;
    option.addEventListener("click", () => chooseState(state));
    stateList.appendChild(option);
  }
}

function stateOptions() {
  return [...stateList.querySelectorAll(".option")];
}

function openStateList() {
  stateList.hidden = false;
  stateButton.setAttribute("aria-expanded", "true");
  const selected = stateList.querySelector('[aria-selected="true"]');
  (selected || stateOptions()[0]).focus();
  if (selected) selected.scrollIntoView({ block: "center" });
  postHeight();
}

function closeStateList({ refocus = false } = {}) {
  if (stateList.hidden) return;
  stateList.hidden = true;
  stateButton.setAttribute("aria-expanded", "false");
  if (refocus) stateButton.focus();
  postHeight();
}

stateButton.addEventListener("click", () => {
  if (stateList.hidden) openStateList();
  else closeStateList();
});

stateButton.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    openStateList();
  }
});

stateList.addEventListener("keydown", (e) => {
  const options = stateOptions();
  const index = options.indexOf(document.activeElement);

  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    const step = e.key === "ArrowDown" ? 1 : -1;
    const next = Math.min(Math.max(index + step, 0), options.length - 1);
    options[next].focus();
  } else if (e.key === "Home" || e.key === "End") {
    e.preventDefault();
    options[e.key === "Home" ? 0 : options.length - 1].focus();
  } else if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    document.activeElement.click();
  } else if (e.key === "Escape" || e.key === "Tab") {
    closeStateList({ refocus: e.key === "Escape" });
  } else if (/^[a-z]$/i.test(e.key)) {
    // Jump to the next state starting with that letter, as a native select does.
    const after = options.slice(index + 1).concat(options.slice(0, index + 1));
    const match = after.find((o) =>
      o.textContent.toLowerCase().startsWith(e.key.toLowerCase())
    );
    if (match) match.focus();
  }
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".select-wrap")) closeStateList();
});

async function chooseState(state) {
  currentStateName = state.name;
  currentStateCode = state.code;

  stateValue.textContent = state.name;
  stateButton.classList.remove("is-placeholder");
  for (const option of stateOptions()) {
    option.setAttribute("aria-selected", String(option.dataset.code === state.code));
  }
  closeStateList({ refocus: true });

  resetResults();
  searchInput.value = "";
  searchInput.disabled = true;
  searchSection.hidden = true;

  setStatus(`Loading schools in ${currentStateName}…`);
  try {
    currentSchools = await loadStateSchools(state.code);
    setStatus("");
    searchSection.hidden = false;
    searchInput.disabled = false;
    searchInput.focus();
    postHeight();
  } catch (err) {
    console.error(err);
    currentSchools = [];
    setStatus(
      `We don't have ${currentStateName} schools loaded yet. Email ${SUPPORT_EMAIL} and we'll help you check.`
    );
    postHeight();
  }
}

searchInput.addEventListener("input", () => {
  const query = searchInput.value.trim().toLowerCase();
  resultCard.hidden = true;
  resultCard.innerHTML = "";

  if (query.length < 2) {
    resultsList.innerHTML = "";
    resultsList.hidden = true;
    postHeight();
    return;
  }

  const matches = currentSchools
    .filter((school) => school.school_name.toLowerCase().includes(query))
    .slice(0, 30);

  renderResults(matches);
});

function renderResults(matches) {
  resultsList.innerHTML = "";

  if (matches.length === 0) {
    resultsList.hidden = false;
    const li = document.createElement("li");
    li.className = "no-match";
    li.textContent = "No schools with that name. Try a shorter search.";
    resultsList.appendChild(li);
    postHeight();
    return;
  }

  for (const school of matches) {
    const li = document.createElement("li");
    li.className = "result-item";
    li.tabIndex = 0;

    const name = document.createElement("span");
    name.className = "school-name";
    name.textContent = school.school_name;

    const city = document.createElement("span");
    city.className = "school-city";
    city.textContent = cityWithState(school);

    li.append(name, city);
    li.addEventListener("click", () => selectSchool(school));
    li.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selectSchool(school);
      }
    });
    resultsList.appendChild(li);
  }
  resultsList.hidden = false;
  postHeight();
}

function selectSchool(school) {
  resultsList.hidden = true;
  renderEligibility(school);
  postHeight();
}

function renderEligibility(school) {
  const topGrade = gradeNumber(school.max_grade);
  const tooYoung = topGrade !== null && topGrade < LOWEST_SERVED_GRADE;
  const eligible = !tooYoung && isEligible(school);
  // Only schools that also have younger students get the note: a 6th-grade-
  // only school is fully served. An unknown lowest grade keeps the note.
  const lowGrade = gradeNumber(school.min_grade);
  const partlyServed =
    eligible &&
    topGrade === LOWEST_SERVED_GRADE &&
    (lowGrade === null || lowGrade < LOWEST_SERVED_GRADE);

  resultCard.innerHTML = eligible ? ICON_ELIGIBLE : ICON_NOT_ELIGIBLE;
  resultCard.hidden = false;
  resultCard.className = `result-card ${
    partlyServed ? "eligible-caveat" : eligible ? "eligible" : "not-eligible"
  }`;

  const body = document.createElement("div");
  body.className = "result-body";

  const heading = document.createElement("h2");
  heading.textContent = eligible
    ? "This school is eligible"
    : "This school isn't eligible";
  body.appendChild(heading);

  const schoolInfo = document.createElement("p");
  schoolInfo.className = "school-info";
  schoolInfo.textContent = school.school_name;
  body.appendChild(schoolInfo);

  const meta = document.createElement("p");
  meta.className = "school-meta";
  meta.textContent = [gradeRange(school), school.district_name, cityWithState(school)]
    .filter(Boolean)
    .join(" · ");
  body.appendChild(meta);

  if (tooYoung) {
    body.appendChild(explanationParagraph(
      "UPchieve currently provides support for students in 6th through " +
        "12th grade."
    ));
  } else if (partlyServed) {
    const note = explanationParagraph(
      " UPchieve currently provides support for students in 6th through " +
        "12th grade. This means that only a limited number of students at your " +
        "school would be eligible to receive support from UPchieve."
    );
    const label = document.createElement("strong");
    label.textContent = "NOTE:";
    note.prepend(label);
    body.appendChild(note);
  } else if (!eligible) {
    const explanation = document.createElement("p");
    explanation.className = "explanation";
    const supportLink = document.createElement("a");
    supportLink.href = `mailto:${SUPPORT_EMAIL}`;
    supportLink.textContent = SUPPORT_EMAIL;
    explanation.append(
      "If you believe your school should be eligible based on the criteria " +
        "above, please reach out to us at ",
      supportLink,
      "."
    );
    body.appendChild(explanation);
  }

  resultCard.appendChild(body);
  resultCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function explanationParagraph(text) {
  const p = document.createElement("p");
  p.className = "explanation";
  p.textContent = text;
  return p;
}

// "Prekindergarten" -> -1, "Kindergarten" -> 0, "6th Grade" -> 6. Anything
// else (blank, "Ungraded", "Adult Education") is null: no grade rule applies.
function gradeNumber(value) {
  const text = (value || "").trim().toLowerCase();
  if (text === "prekindergarten") return -1;
  if (text === "kindergarten") return 0;
  const match = text.match(/^(\d+)(st|nd|rd|th) grade$/);
  return match ? Number(match[1]) : null;
}

// "Grades K-5", or "Grade 6" for a single grade. Left out when either end
// isn't a numbered grade (blank, "Ungraded", "Adult Education"). Shown no
// higher than 12th: NCES lists some early-college high schools as going to 13th.
function gradeRange(school) {
  let low = gradeNumber(school.min_grade);
  let high = gradeNumber(school.max_grade);
  if (low === null || high === null) return "";
  if (high > 12) high = 12;
  if (low > 12) low = 12;
  if (low === high) return `Grade ${gradeShort(low)}`;
  return `Grades ${gradeShort(low)}-${gradeShort(high)}`;
}

function gradeShort(number) {
  if (number === -1) return "PK";
  if (number === 0) return "K";
  return String(number);
}

function cityWithState(school) {
  if (!school.city_name) return "";
  return currentStateCode
    ? `${school.city_name}, ${currentStateCode}`
    : school.city_name;
}

function isEligible(school) {
  if (school.admin_approved.toLowerCase() === "true") return true;

  const total = Number(school.total_students);
  const frl = Number(school.frl_eligible_students);
  const hasValidCounts = Number.isFinite(total) && total > 0 && Number.isFinite(frl);

  const meetsFRL = hasValidCounts && frl / total >= FRL_THRESHOLD;
  const meetsCEO = isCommunityEligibilityYes(school.national_school_lunch_program);

  return meetsFRL || meetsCEO;
}

// Must not match "Yes participating without using any Provision or the CEO",
// which contains "CEO" but means the school is not using it.
function isCommunityEligibilityYes(value) {
  if (!value) return false;
  return value
    .toString()
    .trim()
    .toLowerCase()
    .startsWith("yes under community eligibility");
}

async function loadStateSchools(code) {
  const response = await fetch(`data/${code}.csv`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`No CSV found for state ${code}`);
  }
  const text = await response.text();
  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (parsed.errors && parsed.errors.length > 0) {
    console.warn("CSV parse warnings:", parsed.errors);
  }

  return parsed.data
    .map((row) => ({
      school_name: (row.school_name || "").trim(),
      district_name: (row.district_name || "").trim(),
      city_name: (row.city_name || "").trim(),
      total_students: (row.total_students || "").toString().trim(),
      frl_eligible_students: (row.frl_eligible_students || "").toString().trim(),
      national_school_lunch_program: (row.national_school_lunch_program || "").trim(),
      admin_approved: (row.admin_approved || "").trim(),
      min_grade: (row.min_grade || "").trim(),
      max_grade: (row.max_grade || "").trim(),
    }))
    .filter((row) => row.school_name.length > 0);
}

function resetResults() {
  resultsList.innerHTML = "";
  resultsList.hidden = true;
  resultCard.hidden = true;
  resultCard.innerHTML = "";
  setStatus("");
  postHeight();
}

function setStatus(msg) {
  statusMessage.textContent = msg;
}

/* ——— Embedding ———
   Tell a host page how tall this content is, so an iframe can size to it.
   The results dropdown is absolutely positioned and so does not grow the
   document — it has to be measured separately or it gets clipped. */

function postHeight() {
  if (window.parent === window) return;
  // Measured off the content, not scrollHeight: inside an iframe scrollHeight
  // never reports less than the iframe's own height, so it could not shrink.
  const page = document.querySelector(".page");
  let height = Math.ceil(page.getBoundingClientRect().bottom + window.scrollY);
  for (const panel of document.querySelectorAll(".results-list:not([hidden])")) {
    const bottom = panel.getBoundingClientRect().bottom + window.scrollY;
    height = Math.max(height, Math.ceil(bottom) + 16);
  }
  // A couple of pixels of slack: at an exact fit, sub-pixel rounding is
  // enough to raise a scrollbar inside the frame.
  window.parent.postMessage(
    { type: "upchieve-eligibility-height", height: height + 2 },
    "*"
  );
}

// Observes the content element, not body: body is stretched by the iframe
// viewport, so it does not always change size when the content does.
new ResizeObserver(postHeight).observe(document.querySelector(".page"));
window.addEventListener("load", postHeight);
