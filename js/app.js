const FRL_THRESHOLD = 0.40;

// TODO: replace with the real nomination form URL
const NOMINATION_URL = "#";
const SUPPORT_EMAIL = "support@upchieve.org";

const ICON_ELIGIBLE = `<svg class="result-icon" viewBox="0 0 44 44" fill="none" aria-hidden="true"><circle cx="21.93" cy="22.2" r="19.79" fill="#f2fbf9" stroke="#16d2aa" stroke-width="4"/><path d="m19.6 27.99.75.75m-.75-.75-.75.75m.75-.75c.75.75.75.75.75.75m0 0c-.41.42-1.09.42-1.5 0m1.5 0 10.95-10.95c.42-.42.42-1.09 0-1.51-.41-.41-1.09-.41-1.5 0l-10.2 10.2-4.93-4.93c-.41-.41-1.09-.41-1.5 0-.42.42-.42 1.09 0 1.51l5.68 5.68" stroke="#16d2aa" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></svg>`;

const ICON_NOT_ELIGIBLE = `<svg class="result-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="m8 16c4.4183 0 8-3.5817 8-8 0-4.41828-3.5817-8-8-8-4.41827 0-8 3.58172-8 8 0 4.4183 3.58173 8 8 8zm-.784-10.608c.15198.136.36798.204.64801.204.27198 0 .47998-.068.62397-.204.15203-.144.22802-.344.22802-.6s-.07599-.452-.22802-.588c-.14399-.136-.35199-.204-.62397-.204-.28003 0-.49603.068-.64801.204-.14398.136-.216.332-.216.588s.07202.456.216.6zm1.284 7.212v-6h-1.284v6z" fill="#1855d1"/></svg>`;

const stateSelect = document.getElementById("state-select");
const searchSection = document.getElementById("search-section");
const searchInput = document.getElementById("school-search");
const resultsList = document.getElementById("results-list");
const resultCard = document.getElementById("result-card");
const statusMessage = document.getElementById("status-message");

let currentSchools = [];
let currentStateName = "";

populateStates();

function populateStates() {
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select your state";
  placeholder.disabled = true;
  placeholder.selected = true;
  stateSelect.appendChild(placeholder);

  for (const state of STATES) {
    const option = document.createElement("option");
    option.value = state.code;
    option.textContent = state.name;
    stateSelect.appendChild(option);
  }
}

stateSelect.addEventListener("change", async () => {
  const code = stateSelect.value;
  const state = STATES.find((s) => s.code === code);
  currentStateName = state ? state.name : "";
  resetResults();
  searchInput.value = "";
  searchInput.disabled = true;
  searchSection.hidden = true;

  if (!code) return;

  setStatus(`Loading schools in ${currentStateName}…`);
  try {
    currentSchools = await loadStateSchools(code);
    setStatus("");
    searchSection.hidden = false;
    searchInput.disabled = false;
    searchInput.focus();
  } catch (err) {
    console.error(err);
    currentSchools = [];
    setStatus(
      `We don't have ${currentStateName} schools loaded yet. Email ${SUPPORT_EMAIL} and we'll help you check.`
    );
  }
});

searchInput.addEventListener("input", () => {
  const query = searchInput.value.trim().toLowerCase();
  resultCard.hidden = true;
  resultCard.innerHTML = "";

  if (query.length < 2) {
    resultsList.innerHTML = "";
    resultsList.hidden = true;
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
    city.textContent = school.city_name;

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
}

function selectSchool(school) {
  resultsList.hidden = true;
  renderEligibility(school);
}

function renderEligibility(school) {
  const eligible = isEligible(school);

  resultCard.innerHTML = eligible ? ICON_ELIGIBLE : ICON_NOT_ELIGIBLE;
  resultCard.hidden = false;
  resultCard.className = `result-card ${eligible ? "eligible" : "not-eligible"}`;

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
  meta.textContent = [school.district_name, school.city_name]
    .filter(Boolean)
    .join(" · ");
  body.appendChild(meta);

  if (eligible) {
    const nominate = document.createElement("a");
    nominate.className = "btn btn-primary";
    nominate.href = NOMINATION_URL;
    nominate.textContent = "Nominate your school";
    body.appendChild(nominate);
  }

  resultCard.appendChild(body);
  resultCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function isEligible(school) {
  const total = Number(school.total_students);
  const frl = Number(school.frl_eligible_students);
  const hasValidCounts = Number.isFinite(total) && total > 0 && Number.isFinite(frl);

  const meetsFRL = hasValidCounts && frl / total >= FRL_THRESHOLD;
  const meetsCEO = isCommunityEligibilityYes(school.national_school_lunch_program);

  return meetsFRL || meetsCEO;
}

function isCommunityEligibilityYes(value) {
  if (!value) return false;
  const normalized = value.toString().trim().toLowerCase();
  return (
    normalized.includes("yes") &&
    (normalized.includes("community eligibility") || normalized.includes("ceo"))
  );
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
    }))
    .filter((row) => row.school_name.length > 0);
}

function resetResults() {
  resultsList.innerHTML = "";
  resultsList.hidden = true;
  resultCard.hidden = true;
  resultCard.innerHTML = "";
  setStatus("");
}

function setStatus(msg) {
  statusMessage.textContent = msg;
}
