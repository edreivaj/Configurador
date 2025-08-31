// === Script offline con tolerancia de nombres (ñ/no ñ, .png/.PNG/.jpg/.webp) ===

const KITCHEN_COUNT = 19;   // cocina_1.png .. cocina_19.png
const BATH_COUNT = 36;      // baño_1.png .. baño_36.png

const houseBase = "casas";
const kitchensDir = "Cocinas";
const bathsPreferred = "Baños";
const bathsFallback = "Banos";

function joinEncoded(base, ...segs){
  const root = base.replace(/\/+$/,''); // sin barra final
  const tail = segs.map(s => encodeURIComponent(s)).join('/');
  return tail ? `${root}/${tail}` : root;
}

function probeImage(url){
  return new Promise(resolve => {
    const img = new Image();
    let done = false;
    img.onload = () => { if (!done){ done = true; resolve(true); } };
    img.onerror = () => { if (!done){ done = true; resolve(false); } };
    img.src = url + (url.includes('?') ? '&' : '?') + 't=' + Date.now();
  });
}

async function detectBathsFolder(){
  const testPreferred = joinEncoded(houseBase, bathsPreferred, "baño_1.png");
  if (await probeImage(testPreferred)) return bathsPreferred;
  const testFallback = joinEncoded(houseBase, bathsFallback, "baño_1.png");
  if (await probeImage(testFallback)) return bathsFallback;
  // Alternativas por si los archivos estuvieran sin ñ
  const testPreferredNoTilde = joinEncoded(houseBase, bathsPreferred, "bano_1.png");
  if (await probeImage(testPreferredNoTilde)) return bathsPreferred;
  const testFallbackNoTilde = joinEncoded(houseBase, bathsFallback, "bano_1.png");
  if (await probeImage(testFallbackNoTilde)) return bathsFallback;
  return bathsPreferred;
}

// Crea lista de candidatos de ruta para un nombre base (con y sin ñ) y varias extensiones
function buildCandidates(dir, baseWithTilde){
  const baseNoTilde = baseWithTilde.replace('ñ','n');
  const exts = [".png",".PNG",".jpg",".JPG",".jpeg",".JPEG",".webp",".WEBP"];
  const names = [baseWithTilde, baseNoTilde];
  const candidates = [];
  for (const name of names){
    for (const ext of exts){
      candidates.push(joinEncoded(houseBase, dir, name + ext));
    }
  }
  return candidates;
}

function createImgWithSpinner(srcOrArray, alt, cssClass = "") {
  const candidates = Array.isArray(srcOrArray) ? srcOrArray.slice() : [srcOrArray];
  const container = document.createElement('div');
  container.className = "img-container";
  const spinner = document.createElement('div');
  spinner.className = "img-spinner";
  spinner.innerHTML = `<svg viewBox="0 0 50 50"><circle cx="25" cy="25" r="20" stroke="#1F8F5A" stroke-width="6" fill="none" stroke-linecap="round"></circle></svg>`;
  container.appendChild(spinner);

  const img = document.createElement('img');
  img.className = cssClass;
  img.alt = alt;
  img.loading = "lazy";
  img.style.opacity = 0;
  spinner.style.display = "block";

  function tryNext() {
    if (!candidates.length) {
      spinner.style.display = "none";
      img.style.display = "none";
      const fallback = document.createElement('div');
      fallback.textContent = alt;
      fallback.style.padding = "8px";
      fallback.style.textAlign = "center";
      container.appendChild(fallback);
      return;
    }
    const next = candidates.shift();
    img.src = next + (next.includes('?') ? '&' : '?') + 't=' + Date.now();
  }

  img.onload = () => {
    img.classList.add('img-loaded');
    spinner.style.display = "none";
  };
  img.onerror = () => {
    tryNext();
  };

  container.appendChild(img);
  tryNext();
  return container;
}

// --- Ayudas resumidas ---
const ayudas = {
  estilo_casa: { label: "¿Qué significa 'Estilo de casa'?", text: "Define la distribución principal. 'Lineal' agrupa en una línea; 'Panorámico' prioriza vistas y luz." },
  cubierta: { label: "¿Qué es 'Cubierta'?", text: "Plana: estética moderna; Inclinada: mejor drenaje y aire más tradicional." },
  habitaciones: { label: "¿Dormitorios?", text: "Valora necesidades actuales y futuras (teletrabajo, visitas, familia)." },
  plantas: { label: "¿1 o 2 plantas?", text: "1 planta = accesible; 2 plantas = separa zonas día/noche." },
  fachada: { label: "Fachada", text: "Minimalismo, Biofílico, Brisa o Industrial." },
  cocina_img: { label:"Cocina", text:"Elige la imagen de cocina que prefieras." },
  bano_img: { label:"Baño", text:"Elige la imagen de baño que prefieras." }
};

function showAyuda(key) {
  const ayuda = ayudas[key];
  if (!ayuda) return;
  const popup = document.getElementById('popup-ayuda');
  const content = document.getElementById('popup-ayuda-content');
  content.innerHTML = `<strong>${ayuda.label}</strong><br><br>${ayuda.text.replaceAll('\\n','<br>')}`;
  popup.style.display = 'flex';
}
document.getElementById('popup-ayuda-close').onclick = () => {
  document.getElementById('popup-ayuda').style.display = 'none';
};

// Estado
let selections = {};
let currentStep = 0;
let kitchenFiles = [];
let bathFiles = [];
let bathsDirUsed = bathsPreferred;

// Construye listas por patrón (con múltiples candidatos por imagen)
async function buildKitchenList(){
  const arr = [];
  for (let i=1; i<=KITCHEN_COUNT; i++){
    const base = `cocina_${i}`;
    const candidates = buildCandidates(kitchensDir, base); // aquí no hay ñ, pero contempla .PNG/.jpg/.webp
    arr.push({ id: `${base}.png`, label: base, img: candidates });
  }
  kitchenFiles = arr;
}
async function buildBathList(){
  bathsDirUsed = await detectBathsFolder();
  const arr = [];
  for (let i=1; i<=BATH_COUNT; i++){
    const base = `baño_${i}`; // con ñ por defecto
    const candidates = buildCandidates(bathsDirUsed, base);
    arr.push({ id: `${base}.png`, label: base, img: candidates });
  }
  bathFiles = arr;
}

// Pasos del wizard (sin cambios en lógica de casa/fachada)
const steps = [
  { label:"Elige el estilo de casa", key:"estilo_casa",
    options: () => [
      { id:"lineal", label:"Lineal", img:`${houseBase}/lineal.png` },
      { id:"panoramico", label:"Panorámico", img:`${houseBase}/panoramico.png` }
    ]
  },
  { label:"Tipo de cubierta", key:"cubierta",
    options: s => [
      { id:"plana", label:"Plana", img:`${houseBase}/${s.estilo_casa}_cubierta_plana.png` },
      { id:"inclinada", label:"Inclinada", img:`${houseBase}/${s.estilo_casa}_cubierta_inclinada.png` }
    ]
  },
  { label:"Número de habitaciones", key:"habitaciones",
    options: s => {
      const base = `${s.estilo_casa}_${s.cubierta}`;
      return [
        { id:"1", label:"1", img:`${houseBase}/${base}_1hab.png` },
        { id:"2", label:"2", img:`${houseBase}/${base}_2hab.png` },
        { id:"3", label:"3", img:`${houseBase}/${base}_3hab.png` },
        { id:"4", label:"4", img:`${houseBase}/${base}_4hab.png` }
      ];
    }
  },
  { label:"¿Cuántas plantas?", key:"plantas", onlyIf:{ habitaciones:"3", estilo_casa:"lineal" },
    options: s => {
      const base = `${s.estilo_casa}_${s.cubierta}_3hab`;
      return [
        { id:"1p", label:"1 planta", img:`${houseBase}/${base}_1p.png` },
        { id:"2p", label:"2 plantas", img:`${houseBase}/${base}_2p.png` }
      ];
    }
  },
  { label:"Estilo de fachada", key:"fachada",
    options: s => {
      let base = `${s.estilo_casa}_${s.cubierta}_${s.habitaciones}hab`;
      if (s.habitaciones === "3" && s.plantas) base += `_${s.plantas}`;
      return [
        { id:"minimalismo", label:"Minimalismo Racional", img:`${houseBase}/${base}_minimalismo.png` },
        { id:"biofilico", label:"Green Biofílico", img:`${houseBase}/${base}_biofilico.png` },
        { id:"brisa", label:"Brisa Natural", img:`${houseBase}/${base}_brisa.png` },
        { id:"industrial", label:"Moderno Industrial", img:`${houseBase}/${base}_industrial.png` }
      ];
    }
  },
  { label:"Elige la cocina", key:"cocina_img", options: () => kitchenFiles },
  { label:"Elige el baño", key:"bano_img", options: () => bathFiles }
];

function renderProgreso(stepIdx){
  let total = 0, actual = 0;
  for (let i=0;i<steps.length;i++){
    const st = steps[i];
    if (!st.onlyIf || Object.entries(st.onlyIf).every(([k,v]) => selections[k]===v)) total++;
    if (i<=stepIdx && (!st.onlyIf || Object.entries(st.onlyIf).every(([k,v]) => selections[k]===v))) actual++;
  }
  const porc = Math.round(100 * actual / total);
  document.getElementById('progreso').innerHTML = `
    <div class="progress-bar-bg"><div class="progress-bar" style="width:${porc}%;"></div></div>
    <div class="progress-txt">Paso ${actual} de ${total}</div>`;
}

function fadeReplaceContent(elem, renderFn){
  elem.classList.add('fade-exit-active');
  setTimeout(() => {
    renderFn();
    elem.classList.remove('fade-exit-active');
    elem.classList.add('fade-enter');
    setTimeout(() => {
      elem.classList.add('fade-enter-active');
      setTimeout(() => { elem.classList.remove('fade-enter','fade-enter-active'); }, 500);
    }, 20);
  }, 400);
}

function showAyudaIfExists(stepData, labelEl){
  if (ayudas[stepData.key]){
    const icon = document.createElement('span');
    icon.className = 'icon-ayuda';
    icon.innerHTML = '🛈';
    icon.title = 'Ver ayuda';
    icon.onclick = () => showAyuda(stepData.key);
    labelEl.appendChild(icon);
  }
}

function renderStep(step){
  renderProgreso(step);
  const container = document.getElementById('choices');
  container.innerHTML = '';
  document.getElementById('summary').style.display = 'none';
  document.getElementById('restartBtn').style.display = 'none';
  const pdfBtn = document.getElementById('exportPDFBtn'); if (pdfBtn) pdfBtn.style.display = 'none';

  if (steps[step]?.onlyIf){
    let show = true;
    for (let cond in steps[step].onlyIf) if (selections[cond] !== steps[step].onlyIf[cond]) show = false;
    if (!show) {
      const k = steps[step].key;
      if (k && selections[k] !== undefined) delete selections[k];
      return renderStep(step + 1);
    }
}

  const stepData = steps[step];
  if (!stepData){ renderSummary(); return; }

  const label = document.createElement('div');
  label.className = "choice-label";
  label.innerHTML = stepData.label;
  showAyudaIfExists(stepData, label);
  container.appendChild(label);

  const options = typeof stepData.options === "function" ? stepData.options(selections) : stepData.options;

  const group = document.createElement('div');
  group.className = "choices-group";
  const numOptions = options.length;
  if (window.innerWidth >= 1900){
    if (numOptions <= 4) group.classList.add("columns-2");
    else group.classList.add("columns-3");
  }

  options.forEach(option => {
    const btn = document.createElement('button');
    btn.style.display = "block";
    btn.style.border = "none";
    btn.style.background = "none";
    btn.onclick = () => {
      selections[stepData.key] = option.id;
      currentStep = step + 1;
      if (stepData.key === 'fachada') return renderPreviewAfterFachada(() => renderStep(currentStep));
      fadeReplaceContent(container, () => renderStep(currentStep));
      document.getElementById('backBtn').style.display = currentStep > 0 ? 'inline' : 'none';
    };
    btn.appendChild(createImgWithSpinner(option.img, option.label, "choice-img"));
    const text = document.createElement('div');
    text.innerText = option.label;
    btn.appendChild(text);
    group.appendChild(btn);
  });

  if (options.length === 0){
    const info = document.createElement('div');
    info.style.margin = "12px 0 8px";
    info.innerHTML = `No se encontraron imágenes. Comprueba las rutas y nombres.`;
    container.appendChild(info);
  }

  container.appendChild(group);
  document.getElementById('backBtn').style.display = step > 0 ? 'inline' : 'none';
}


function renderSummary(){
  
  // Progreso: en resumen no mostramos "Paso X de Y"
  const prog = document.getElementById('progreso');
  if (prog) {
    prog.innerHTML = `
      <div class="progress-bar-bg">
        <div class="progress-bar" style="width:100%;"></div>
      </div>
      <div class="progress-txt">Resumen</div>
    `;
  }
const container = document.getElementById('choices');
  container.innerHTML = '';
  const summaryDiv = document.getElementById('summary');
  summaryDiv.innerHTML = '';

  const title = document.createElement('h2');
  title.textContent = "Resumen";
  summaryDiv.appendChild(title);

  // Wrapper
  const wrap = document.createElement('div');
  wrap.style.display = "grid";
  wrap.style.gridTemplateColumns = "1fr";
  wrap.style.gap = "14px";
  if (window.innerWidth >= 900) {
    wrap.style.gridTemplateColumns = "repeat(3, 1fr)";
  }

  // 1) Casa configurada
  let base = `${selections.estilo_casa}_${selections.cubierta}_${selections.habitaciones}hab`;
  if (selections.habitaciones === "3" && selections.plantas) base += `_${selections.plantas}`;
  const fachadaId = selections.fachada;
  const casaURL = `casas/${base}_${fachadaId}.png`;

  const casaBlock = document.createElement('div');
  casaBlock.className = "summary-block";
  casaBlock.style.flexDirection = "column";
  casaBlock.style.alignItems = "stretch";
  const casaImg = createImgWithSpinner(casaURL, "Casa", "choice-img");
  casaBlock.appendChild(casaImg);
  const casaTxt = document.createElement('div');
  casaTxt.style.marginTop = "8px";
  casaTxt.innerHTML = "<strong>Casa</strong>";
  casaBlock.appendChild(casaTxt);
  wrap.appendChild(casaBlock);

  // 2) Cocina elegida
  const selKitchenId = selections.cocina_img;
  let kitchenSel = null;
  try { kitchenSel = (typeof steps.find(s=>s.key==='cocina_img').options === 'function' ? steps.find(s=>s.key==='cocina_img').options(selections) : steps.find(s=>s.key==='cocina_img').options).find(o=>o.id===selKitchenId); } catch(_){}
  const cocinaBlock = document.createElement('div');
  cocinaBlock.className = "summary-block";
  cocinaBlock.style.flexDirection = "column";
  cocinaBlock.style.alignItems = "stretch";
  if (kitchenSel){
    const cocinaImg = createImgWithSpinner(kitchenSel.img, "Cocina", "choice-img");
    cocinaBlock.appendChild(cocinaImg);
  }
  const cocinaTxt = document.createElement('div');
  cocinaTxt.style.marginTop = "8px";
  cocinaTxt.innerHTML = "<strong>Cocina</strong>";
  cocinaBlock.appendChild(cocinaTxt);
  wrap.appendChild(cocinaBlock);

  // 3) Baño elegido
  const selBathId = selections.bano_img;
  let bathSel = null;
  try { bathSel = (typeof steps.find(s=>s.key==='bano_img').options === 'function' ? steps.find(s=>s.key==='bano_img').options(selections) : steps.find(s=>s.key==='bano_img').options).find(o=>o.id===selBathId); } catch(_){}
  const banoBlock = document.createElement('div');
  banoBlock.className = "summary-block";
  banoBlock.style.flexDirection = "column";
  banoBlock.style.alignItems = "stretch";
  if (bathSel){
    const banoImg = createImgWithSpinner(bathSel.img, "Baño", "choice-img");
    banoBlock.appendChild(banoImg);
  }
  const banoTxt = document.createElement('div');
  banoTxt.style.marginTop = "8px";
  banoTxt.innerHTML = "<strong>Baño</strong>";
  banoBlock.appendChild(banoTxt);
  wrap.appendChild(banoBlock);

  summaryDiv.appendChild(wrap);

  
  // --- Lista textual de la configuración de la casa (sin cocina/baño) ---
  const listWrap = document.createElement('div');
  listWrap.className = "summary-list";
  listWrap.style.marginTop = "16px";

  const listTitle = document.createElement('h3');
  listTitle.textContent = "Configuración seleccionada";
  listTitle.style.margin = "0 0 8px 0";
  listWrap.appendChild(listTitle);

  const ul = document.createElement('ul');
  ul.style.lineHeight = "1.6";

  const labelEstilo = { lineal:"Lineal", panoramico:"Panorámico" }[selections.estilo_casa] || selections.estilo_casa || "";
  const labelCubierta = { plana:"Plana", inclinada:"Inclinada" }[selections.cubierta] || selections.cubierta || "";
  const labelPlantas = selections.habitaciones === "3"
    ? ({ "1p":"1 planta", "2p":"2 plantas" }[selections.plantas] || selections.plantas || "")
    : "";
  const labelFachada = { minimalismo:"Minimalismo racional", biofilico:"Green biofílico", brisa:"Brisa natural", industrial:"Moderno industrial" }[selections.fachada] || selections.fachada || "";

  function addItem(label, value){
    if (!value) return;
    const li = document.createElement('li');
    li.innerHTML = `<strong>${label}:</strong> ${value}`;
    ul.appendChild(li);
  }

  addItem("Estilo de casa", labelEstilo);
  addItem("Cubierta", labelCubierta);
  addItem("Dormitorios", selections.habitaciones ? `${selections.habitaciones}` : "");
  if (labelPlantas) addItem("Plantas", labelPlantas);
  addItem("Fachada", labelFachada);

  listWrap.appendChild(ul);
  summaryDiv.appendChild(listWrap);
summaryDiv.style.display = 'block';
  const exportBtn = document.getElementById('exportPDFBtn');
  if (exportBtn) exportBtn.style.display = 'inline';
  document.getElementById('restartBtn').style.display = 'inline';
}
;
document.getElementById('restartBtn').onclick = () => {
  selections = {}; currentStep = 0; renderStep(currentStep);
};

function renderPreviewAfterFachada(callback){
  const container = document.getElementById('choices');
  container.innerHTML = '';
  const summaryDiv = document.createElement('div');
  summaryDiv.style.textAlign = "center";
  summaryDiv.style.margin = "20px auto";

  let base = `${selections.estilo_casa}_${selections.cubierta}_${selections.habitaciones}hab`;
  if (selections.habitaciones === "3" && selections.plantas) base += `_${selections.plantas}`;
  const fachadaId = selections.fachada;
  const fachadaLabel = { minimalismo:"Minimalismo racional", biofilico:"Green biofílico", brisa:"Brisa natural", industrial:"Moderno industrial" }[fachadaId] || fachadaId;

  const img = document.createElement('img');
  img.src = `casas/${base}_${fachadaId}.png`;
  img.className = "preview-img";
  img.style.height = "auto";
  img.style.aspectRatio = "16 / 9";
  img.style.borderRadius = "14px";
  img.style.boxShadow = "0 3px 12px rgba(0,0,0,0.2)";
  summaryDiv.appendChild(img);

  const texto = document.createElement('div');
  texto.style.marginTop = "20px";
  texto.style.fontSize = "1.4em";
  texto.style.fontWeight = "bold";
  texto.innerText = `Modelo ${selections.estilo_casa}, con cubierta ${selections.cubierta}, ${selections.habitaciones} dormitorio(s) y fachada estilo ${fachadaLabel}`;
  summaryDiv.appendChild(texto);

  const continuarBtn = document.createElement('button');
  continuarBtn.textContent = "Continuar";
  continuarBtn.style.marginTop = "30px";
  continuarBtn.style.fontSize = "1.2em";
  continuarBtn.style.padding = "12px 28px";
  continuarBtn.style.borderRadius = "10px";
  continuarBtn.style.background = "#258F53";
  continuarBtn.style.color = "#fff";
  continuarBtn.style.border = "none";
  continuarBtn.style.cursor = "pointer";
  continuarBtn.onclick = callback;
  summaryDiv.appendChild(continuarBtn);

  container.appendChild(summaryDiv);
}


document.getElementById('backBtn').onclick = () => {
  // Si estamos en el resumen (o un índice fuera de rango), salta al último paso visible
  if (currentStep >= steps.length || !steps[currentStep]) {
    let last = steps.length - 1;
    // Busca el último paso que cumpla 'onlyIf'
    while (last > 0) {
      const st = steps[last];
      const visible = !st?.onlyIf || Object.entries(st.onlyIf).every(([k, v]) => selections[k] === v);
      if (visible) break;
      last--;
    }
    currentStep = Math.max(0, last);
    renderStep(currentStep);
    return;
  }
  // En pasos normales, retrocede saltando pasos ocultos por 'onlyIf'
  if (currentStep > 0) {
    currentStep--;
    while (currentStep > 0) {
      const st = steps[currentStep];
      const visible = !st?.onlyIf || Object.entries(st.onlyIf).every(([k, v]) => selections[k] === v);
      if (visible) break;
      currentStep--;
    }
    renderStep(currentStep);
  }
};

// Boot
(async () => {
  await buildKitchenList();
  await buildBathList();
  renderStep(0);
})();
