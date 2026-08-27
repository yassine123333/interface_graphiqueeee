const TO = 460;
const CHEVALET_CAPACITY = 450;
const CHEVALET_MAX = 450;
const LINGO_BASE_METRAGE = 4000;
const THP_REEL_UNITAIRE = 0.04166063545;
const TRS_TRG_RATIO = 1.406712313;

// Parametres optimaux LINGO affiches dans l'interface.
const LINGO_OPTIMAL = {
  T_pratique_unitaire: 0.0325464,
  THP_unitaire: 0.03504675,
  X1: 30.725,
  X2: 90,
  X3: 77.55,
};

const DEFAULTS = {
  metrage: 2400,
  vitesse: 30,
  tempMousse: 210,
  tempEnvers: 198,
  ecartHaut: 1.9,
  ecartBas: 1.8,
  operateurs: 5,
};

const MAIN_COEFFICIENTS = [
  { key: 'THP', label: 'THP', coeff: 0.0084, group: 'thp' },
  { key: 'TMP', label: 'TMP', coeff: 0.0041, group: 'tmp' },
  { key: 'T_maintenance_1er_niveau', label: 'T Maintenance 1er Niveau', coeff: 0.00225, group: 'interne' },
  { key: 'T_preparation_mise_en_route', label: 'Préparation / mise en route', coeff: 0.0015, group: 'interne' },
  { key: 'T_changement_mousse_soudure', label: 'Changement mousse + soudure', coeff: 0.0031, group: 'interne' },
  { key: 'T_changement_endroit', label: 'Changement endroit', coeff: 0.0033, group: 'interne' },
  { key: 'T_changement_envers', label: 'Changement envers', coeff: 0.0028, group: 'interne' },
  { key: 'T_verification_resultat', label: 'Vérification résultat', coeff: 0.0016, group: 'interne' },
  { key: 'T_nettoyage_cylindres', label: 'Nettoyage cylindres', coeff: 0.004759, group: 'interne' },
  { key: 'T_nettoyage_bruleurs', label: 'Nettoyage brûleurs', coeff: 0.0011, group: 'interne' },
  { key: 'T_changement_chevalet_enroulage', label: 'Changement chevalet enroulage', coeff: 0.0016, group: 'interne' },
  { key: 'T_changement_article_complexe', label: 'Changement d’article complexe', coeff: 0.0019, group: 'interne' },
  { key: 'T_essais_sdm_hors_planning', label: 'Essais / SDM hors planning', coeff: 0.0022, group: 'interne' },
  { key: 'T_panne_machine', label: 'Panne machine', coeff: 0.0025, group: 'interne' },
  { key: 'T_manque_matiere_premiere', label: 'Manque matière première', coeff: 0.0018, group: 'externe' },
  { key: 'T_anomalies_de_passage', label: 'Anomalies de passage', coeff: 0.0014, group: 'externe' },
  { key: 'T_probleme_qualite_foam', label: 'Problème qualité Foam', coeff: 0.000144749222, group: 'externe' },
  { key: 'T_probleme_qualite_envers', label: 'Problème qualité Envers', coeff: 0.00004071071868, group: 'externe' },
  { key: 'T_probleme_qualite_endroit', label: 'Problème qualité Endroit', coeff: 0.00002261706593, group: 'externe' },
  { key: 'T_facteurs_externes', label: 'Facteurs externes', coeff: 0.0021, group: 'externe' },
  { key: 'T_manque_planification', label: 'Manque planification', coeff: 0.0016, group: 'externe' },
  { key: 'T_manque_chevalet_enroulage', label: 'Manque chevalet d’enroulage', coeff: 0.0017, group: 'externe' },
  { key: 'T_changement_serie', label: 'Changement de série', coeff: 0.0028, group: 'externe' },
];

let chartInstance = null;
let openingChartInstance = null;

function formatNumber(value, digits = 2) {
  if (!Number.isFinite(value)) return '—';
  return Number(value).toLocaleString('fr-FR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function getFormValues() {
  const form = document.getElementById('process-form');
  const formData = new FormData(form);

  return {
    metrage: Number(formData.get('metrage')),
    vitesse: Number(formData.get('vitesse')),
    tempMousse: Number(formData.get('tempMousse')),
    tempEnvers: Number(formData.get('tempEnvers')),
    ecartHaut: Number(formData.get('ecartHaut')),
    ecartBas: Number(formData.get('ecartBas')),
    operateurs: Number(formData.get('operateurs')),
  };
}

function setFormError(message) {
  const errorBox = document.getElementById('form-error');
  if (!errorBox) return;
  errorBox.textContent = message || '';
  errorBox.classList.toggle('visible', Boolean(message));
}

function validateValues(values) {
  const requiredFields = [
    'metrage',
    'vitesse',
    'tempMousse',
    'tempEnvers',
    'ecartHaut',
    'ecartBas',
    'operateurs',
  ];

  for (const key of requiredFields) {
    if (!Number.isFinite(values[key]) || values[key] <= 0) {
      throw new Error(`Le champ ${key} doit être un nombre strictement supérieur à 0.`);
    }
  }

  if (values.metrage > 4000) {
    throw new Error('Le métrage doit être compris entre 0 et 4000 m.');
  }

  if (values.vitesse < 29 || values.vitesse > 31) {
    throw new Error('La vitesse calandre (X1) doit être comprise entre 29 et 31 m/min.');
  }
}

function computeCoefficients(metrage) {
  return MAIN_COEFFICIENTS.reduce((acc, item) => {
    acc[item.key] = item.coeff * metrage;
    return acc;
  }, {});
}

function computeStopTimeChartData(results) {
  const parts = [
    { label: 'T internes', value: results.T_interne, color: '#184ea8' },
    { label: 'T externes', value: results.T_externe, color: '#5b8def' },
    { label: 'THP', value: results.THP, color: '#d97706' },
    { label: 'TMP', value: results.TMP, color: '#9c5de8' },
  ].sort((a, b) => b.value - a.value);

  return parts.map((part) => ({
    ...part,
    value: (part.value / results.T_arrêt_total) * 100,
  }));
}

function computeOpeningTimeChartData(results) {
  const parts = [
    { label: 'Temps pratique', value: results.T_pratique, color: '#1a9d5d' },
    { label: 'T internes', value: results.T_interne, color: '#184ea8' },
    { label: 'T externes', value: results.T_externe, color: '#5b8def' },
    { label: 'THP', value: results.THP, color: '#d97706' },
    { label: 'TMP', value: results.TMP, color: '#9c5de8' },
  ].sort((a, b) => b.value - a.value);

  return parts.map((part) => ({
    ...part,
    value: (part.value / TO) * 100,
  }));
}

function buildResults(values) {
  const metrage = values.metrage;
  const coeffs = computeCoefficients(metrage);

  // Sous-poste interne : distinct du TMP global utilisé dans la formule (4).
  const T_maintenance_1er_niveau = coeffs.T_maintenance_1er_niveau;
  const THP = metrage * THP_REEL_UNITAIRE;
  const TMP = coeffs.TMP;

  const detailPosts = MAIN_COEFFICIENTS.filter((item) => item.key !== 'THP' && item.key !== 'TMP')
    .map((item) => ({
      key: item.key,
      label: item.label,
      value: coeffs[item.key],
      group: item.group,
    }));

  const T_interne = detailPosts
    .filter((item) => item.group === 'interne')
    .reduce((sum, item) => sum + item.value, 0);

  const T_externe = detailPosts
    .filter((item) => item.group === 'externe')
    .reduce((sum, item) => sum + item.value, 0);

  // TMP est une composante globale distincte de la maintenance de 1er niveau,
  // laquelle reste un sous-poste des arrêts internes.
  const T_arrêt_total = T_interne + T_externe + THP + TMP;
  const T_pratique = metrage / values.vitesse;
  const leadTime = T_pratique + T_arrêt_total;
  const TRG = (T_pratique / leadTime) * 100;
  const TRS = TRS_TRG_RATIO * TRG;
  const T_pratique_optimal = LINGO_OPTIMAL.T_pratique_unitaire * LINGO_BASE_METRAGE;
  const THP_optimal = LINGO_OPTIMAL.THP_unitaire * LINGO_BASE_METRAGE;
  const TRS_optimal = (T_pratique_optimal / (TO - THP_optimal)) * 100;
  const TRS_ecart = TRS - TRS_optimal;
  const percentTempsPratique = (T_pratique / TO) * 100;
  const percentTempsArretTotal = (T_arrêt_total / TO) * 100;
  const percentTInterne = (T_interne / TO) * 100;
  const percentTExterne = (T_externe / TO) * 100;
  const percentTHP = (THP / TO) * 100;
  const percentTMP = (TMP / TO) * 100;
  const percentVerification = (coeffs.T_verification_resultat / coeffs.T_changement_serie) * 100;
  const nChev = metrage / CHEVALET_CAPACITY;
  const frequenceNettoyageCylindre = metrage / 1500;
  const tempsCycle = leadTime / metrage;

  return {
    metrage,
    T_interne,
    T_externe,
    THP,
    TMP,
    T_maintenance_1er_niveau,
    T_arrêt_total,
    T_pratique,
    T_pratique_optimal,
    THP_optimal,
    TRS_optimal,
    TRS_ecart,
    TRG,
    TRS,
    percentTempsPratique,
    percentTempsArretTotal,
    percentTInterne,
    percentTExterne,
    percentTHP,
    percentTMP,
    percentVerification,
    nombreOperateurs: values.operateurs,
    nChev,
    frequenceNettoyageCylindre,
    leadTime,
    tempsCycle,
    detailPosts,
    x1: values.vitesse,
    x2: values.tempMousse,
    x3: values.tempEnvers,
    x1_optimal: LINGO_OPTIMAL.X1,
    x2_optimal: LINGO_OPTIMAL.X2,
    x3_optimal: LINGO_OPTIMAL.X3,
    ecartHaut: values.ecartHaut,
    ecartBas: values.ecartBas,
  };
}

function renderSummary(results) {
  const summary = document.getElementById('result-summary');
  if (!summary) return;
  
  const trsStatus = document.getElementById('trs-status');
  const trsOptimalStatus = document.getElementById('trs-optimal-status');
  if (!trsStatus || !trsOptimalStatus) return;
  
  const isGood = results.TRS > 37;
  const isAboveOptimal = results.TRS_ecart >= 0;

  trsStatus.textContent = isGood
    ? 'Taux de Rendement Synthétique (TRS) satisfaisant'
    : 'Taux de Rendement Synthétique (TRS) faible';
  trsStatus.classList.remove('status-good', 'status-bad');
  trsStatus.classList.add(isGood ? 'status-good' : 'status-bad');
  
  trsOptimalStatus.textContent = isAboveOptimal ? '✓ Au-dessus optimal' : '✗ En-dessous optimal';
  trsOptimalStatus.classList.remove('status-good', 'status-bad');
  trsOptimalStatus.classList.add(isAboveOptimal ? 'status-good' : 'status-bad');

  const summaryItems = [
    { label: 'Taux de Rendement Synthétique (TRS) réel', value: results.TRS, unit: '%', className: isGood ? 'good' : 'bad' },
    { label: 'Taux de Rendement Synthétique (TRS) optimal', value: results.TRS_optimal, unit: '%', className: '' },
    { label: 'Écart du Taux de Rendement Synthétique (TRS)', value: results.TRS_ecart, unit: 'pts', className: isAboveOptimal ? 'good' : 'bad' },
    { label: 'Temps de traversée (Lead Time)', value: results.leadTime, unit: 'min', className: results.leadTime <= TO ? 'good' : 'bad' },
  ];

  summary.innerHTML = summaryItems.map((item) => {
    const valueLabel = formatNumber(item.value, 2);
    return `
      <div class="summary-card ${item.className}">
        <span class="label">${item.label}</span>
        <span class="value">${valueLabel}<span class="unit">${item.unit}</span></span>
      </div>
    `;
  }).join('');

  const openingTime = document.getElementById('opening-time-stat');
  const leadTime = document.getElementById('lead-time-stat');
  const usefulTime = document.getElementById('useful-time-stat');
  if (openingTime) openingTime.textContent = `${formatNumber(TO, 0)} min`;
  if (leadTime) leadTime.textContent = `${formatNumber(results.leadTime, 1)} min`;
  if (usefulTime) usefulTime.textContent = `${formatNumber((results.T_pratique / results.leadTime) * 100, 1)} %`;
}

function buildResultTables(results) {
  const tableRoot = document.getElementById('results-table');
  if (!tableRoot) return;
  const sectionDefs = [
    {
      title: 'Rendements',
      rows: [
        ['Taux de Rendement Global (TRG)', results.TRG, '%'],
        ['Taux de Rendement Synthétique (TRS)', results.TRS, '%'],
        ['Temps pratique', results.percentTempsPratique, '%'],
        ["Temps d'arrêt total", results.percentTempsArretTotal, '%'],
        ["Temps de traversée (Lead Time)", results.leadTime, 'min'],
        ['Temps de cycle', results.tempsCycle, 'min/m'],
      ],
    },
    {
      title: 'Répartition des temps',
      rows: [
        ['Somme des temps à Valeur Ajoutée (Σ VA) = T pratique ', results.T_pratique, 'min'],
        ["Somme des temps à Non-Valeur Ajoutée (Σ NVA) = Temps d'arrêt total", results.T_arrêt_total, 'min'],
        ['T internes', results.T_interne, 'min'],
        ['T externes', results.T_externe, 'min'],
        ['THP', results.THP, 'min'],
        ['TMP', results.TMP, 'min'],
      ],
    },
    {
      title: 'Ressources',
      rows: [
        ['Nombre d’opérateurs', results.nombreOperateurs, 'pers.'],
        ['Nombre de chevalets d’enroulage', results.nChev, 'u.'],
        ['Capacité chevalet maximale', CHEVALET_MAX, 'ML'],
        ['Fréquence nettoyage cylindres', results.frequenceNettoyageCylindre, 'occ.'],
        ['Consommation de gaz totale', 'À préciser', '—'],
      ],
    },
  ];

  tableRoot.innerHTML = sectionDefs.map((section) => {
    const rowsHtml = section.rows.map(([label, value, unit]) => {
      const formattedValue = typeof value === 'number' ? formatNumber(value, 2) : value;
      const isTrs = label.includes('(TRS)');
      const cellClass = isTrs ? (results.TRS > 37 ? 'result-positive' : 'result-negative') : '';
      return `
        <tr>
          <td>${label}</td>
          <td class="${cellClass}">${formattedValue} ${unit}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="table-wrap">
        <table class="results-table">
          <thead>
            <tr><th colspan="2">${section.title}</th></tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;
  }).join('');
}

function displayOptimalParameters() {
  const fields = [
    { target: 'lingoOptimalTPratiqueUnitaire', value: LINGO_OPTIMAL.T_pratique_unitaire, digits: 7 },
    { target: 'lingoOptimalThpUnitaire', value: LINGO_OPTIMAL.THP_unitaire, digits: 8 },
    { target: 'lingoOptimalX1', value: LINGO_OPTIMAL.X1, digits: 3 },
    { target: 'lingoOptimalX2', value: LINGO_OPTIMAL.X2, digits: 0 },
    { target: 'lingoOptimalX3', value: LINGO_OPTIMAL.X3, digits: 2 },
  ];

  for (const field of fields) {
    const targetEl = document.getElementById(field.target);
    if (targetEl) {
      targetEl.value = formatNumber(field.value, field.digits);
    }
  }
}

function renderChart(results) {
  const canvas = document.getElementById('timeChart');
  const data = computeStopTimeChartData(results);
  const context = document.getElementById('chart-context');
  if (context) {
    context.textContent = `Temps d'arrêt total : ${formatNumber(results.T_arrêt_total, 2)} min · chaque temps est rapporté à ce total.`;
  }

  const labels = data.map((entry) => entry.label);
  const values = data.map((entry) => entry.value);

  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  // Petite pause pour laisser le DOM se stabiliser avant Canvas
  setTimeout(() => {
    if (!canvas) return;
    
    chartInstance = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: "% du temps d'arrêt total",
          data: values,
          backgroundColor: data.map((entry) => entry.color),
          borderRadius: 8,
          borderSkipped: false,
          borderWidth: 1,
          borderColor: 'rgba(17,24,39,0.08)',
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 300,
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(15,23,42,0.08)',
            },
            ticks: {
              callback: (value) => `${value}%`,
            },
            title: {
              display: true,
              text: "% du temps d'arrêt total",
              color: '#4a5d75',
              font: { weight: '700' },
            },
          },
          x: {
            grid: {
              display: false,
            },
            title: {
              display: true,
              text: "Sous-postes du temps d'arrêt",
              color: '#4a5d75',
              font: { weight: '700' },
            },
          },
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.parsed.y.toFixed(1)} % du temps d'arrêt total`,
            },
          },
        },
      },
    });
  }, 50);
}

function renderOpeningTimeChart(results) {
  const canvas = document.getElementById('openingTimeChart');
  const data = computeOpeningTimeChartData(results);
  const context = document.getElementById('opening-chart-context');
  if (context) {
    context.textContent = `Temps d'ouverture (To) : ${formatNumber(TO, 0)} min · chaque temps est rapporté à To.`;
  }

  if (openingChartInstance) {
    openingChartInstance.destroy();
    openingChartInstance = null;
  }

  setTimeout(() => {
    if (!canvas) return;
    openingChartInstance = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: data.map((entry) => entry.label),
        datasets: [{
          label: "% du temps d'ouverture (To)",
          data: data.map((entry) => entry.value),
          backgroundColor: data.map((entry) => entry.color),
          borderRadius: 8,
          borderSkipped: false,
          borderWidth: 1,
          borderColor: 'rgba(17,24,39,0.08)',
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(15,23,42,0.08)' },
            ticks: { callback: (value) => `${value}%` },
            title: {
              display: true,
              text: "% du temps d'ouverture (To)",
              color: '#4a5d75',
              font: { weight: '700' },
            },
          },
          x: {
            grid: { display: false },
            title: {
              display: true,
              text: "Composantes du temps d'ouverture (To)",
              color: '#4a5d75',
              font: { weight: '700' },
            },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.parsed.y.toFixed(1)} % du temps d'ouverture (To)`,
            },
          },
        },
      },
    });
  }, 50);
}

function showLoadingState() {
  const button = document.getElementById('calculate-btn');
  const buttonText = button.querySelector('.button-text');
  button.classList.add('is-loading');
  buttonText.textContent = 'Calcul en cours';
}

function resetLoadingState() {
  const button = document.getElementById('calculate-btn');
  const buttonText = button.querySelector('.button-text');
  button.classList.remove('is-loading');
  buttonText.textContent = 'Solution des formules';
}

function handleCalculate() {
  try {
    setFormError('');
    const values = getFormValues();
    validateValues(values);
    const results = buildResults(values);
    renderSummary(results);
    buildResultTables(results);
    displayOptimalParameters();
    
    renderChart(results);
    renderOpeningTimeChart(results);
  } catch (error) {
    setFormError(error.message || 'Erreur de calcul.');
    console.error('Erreur:', error);
  }
}

function init() {
  const calculateBtn = document.getElementById('calculate-btn');

  if (!calculateBtn) {
    console.error('Élément requis non trouvé:', { calculateBtn });
    return;
  }

  Object.entries(DEFAULTS).forEach(([key, value]) => {
    const field = document.querySelector(`[name="${key}"]`);
    if (field) field.value = value;
  });

  displayOptimalParameters();

  calculateBtn.addEventListener('click', handleCalculate);

  handleCalculate();
}

window.addEventListener('DOMContentLoaded', init);
