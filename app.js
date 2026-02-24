const LS_CONFIG = 'sku_last_config';
const LS_TEMPLATES = 'sku_templates';

let sortDirection = 'ASC';
let attrIdCounter = 0;
let generatedSkus = [];

// ── Helpers ──

function getTemplates() {
  try { return JSON.parse(localStorage.getItem(LS_TEMPLATES)) || {}; } catch { return {}; }
}
function setTemplates(t) { localStorage.setItem(LS_TEMPLATES, JSON.stringify(t)); }

function getCurrentConfig() {
  const cards = document.querySelectorAll('.attr-card');
  const attributes = Array.from(cards).map(card => ({
    name: card.querySelector('.attr-name').value.trim(),
    sort_priority: (v => isNaN(v) ? 1 : v)(parseInt(card.querySelector('.attr-priority').value, 10)),
    variants: card.querySelector('.attr-variants').value.split(',').map(v => v.trim()).filter(Boolean)
  }));
  return {
    modelName: document.getElementById('modelName').value.trim(),
    sortDirection,
    attributes
  };
}

function applyConfig(cfg) {
  document.getElementById('modelName').value = cfg.modelName || '';
  setSortDir(cfg.sortDirection || 'ASC');
  document.getElementById('attrContainer').innerHTML = '';
  attrIdCounter = 0;
  (cfg.attributes || []).forEach(a => addAttribute(a));
}

function autoSave() {
  localStorage.setItem(LS_CONFIG, JSON.stringify(getCurrentConfig()));
}

// ── Sort Direction ──

function setSortDir(dir) {
  sortDirection = dir;
  const asc = document.getElementById('btnAsc');
  const desc = document.getElementById('btnDesc');
  if (dir === 'ASC') {
    asc.className = 'flex-1 py-2 text-sm font-medium transition bg-brand-600 text-white';
    desc.className = 'flex-1 py-2 text-sm font-medium transition bg-white text-gray-600 hover:bg-gray-50';
  } else {
    desc.className = 'flex-1 py-2 text-sm font-medium transition bg-brand-600 text-white';
    asc.className = 'flex-1 py-2 text-sm font-medium transition bg-white text-gray-600 hover:bg-gray-50';
  }
}

// ── Attributes ──

function addAttribute(data) {
  const id = attrIdCounter++;
  const container = document.getElementById('attrContainer');
  const card = document.createElement('div');
  card.className = 'attr-card fade-in bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col gap-3';
  card.dataset.id = id;
  card.innerHTML = `
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div class="drag-handle p-1 text-gray-300 hover:text-gray-500 transition" title="Drag to reorder">
          <svg class="w-4 h-4 pointer-events-none" fill="currentColor" viewBox="0 0 16 16">
            <circle cx="5" cy="4" r="1.5"/><circle cx="11" cy="4" r="1.5"/>
            <circle cx="5" cy="8" r="1.5"/><circle cx="11" cy="8" r="1.5"/>
            <circle cx="5" cy="12" r="1.5"/><circle cx="11" cy="12" r="1.5"/>
          </svg>
        </div>
        <span class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Attribute</span>
      </div>
      <button class="remove-attr-btn p-1 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500 transition" title="Remove">
        <svg class="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="grid grid-cols-[1fr_80px] gap-3">
      <div>
        <label class="block text-xs text-gray-500 mb-1">Name</label>
        <input type="text" class="attr-name w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:ring-2 focus:ring-brand-400 focus:border-brand-400 outline-none" placeholder="e.g. Finish" value="${data?.name || ''}" oninput="autoSave()">
      </div>
      <div>
        <label class="block text-xs text-gray-500 mb-1">Sort Priority</label>
        <input type="number" min="0" class="attr-priority w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:ring-2 focus:ring-brand-400 focus:border-brand-400 outline-none" value="${data?.sort_priority ?? 1}" oninput="autoSave()">
      </div>
    </div>
    <div>
      <label class="block text-xs text-gray-500 mb-1">Variants <span class="text-gray-400">(comma-separated)</span></label>
      <input type="text" class="attr-variants w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:ring-2 focus:ring-brand-400 focus:border-brand-400 outline-none" placeholder="e.g. WM, BM" value="${data?.variants?.join(', ') || ''}" oninput="autoSave()">
    </div>
  `;
  container.appendChild(card);
  autoSave();
}

document.getElementById('attrContainer').addEventListener('click', function (e) {
  const btn = e.target.closest('.remove-attr-btn');
  if (btn) {
    btn.closest('.attr-card').remove();
    autoSave();
  }
});

// ── Drag & Drop reordering ──

Sortable.create(document.getElementById('attrContainer'), {
  handle: '.drag-handle',
  animation: 150,
  ghostClass: 'dragging',
  onEnd: function () { autoSave(); }
});

// ── SKU Generation ──

function cartesianProduct(arrays) {
  return arrays.reduce((acc, arr) => {
    const result = [];
    for (const a of acc) for (const b of arr) result.push([...a, b]);
    return result;
  }, [[]]);
}

function generate() {
  const cfg = getCurrentConfig();
  const { modelName, attributes } = cfg;

  if (!modelName) { alert('Please enter a Model Name.'); return; }
  const valid = attributes.filter(a => a.name && a.variants.length > 0);
  if (valid.length === 0) { alert('Add at least one attribute with variants.'); return; }

  const codeLists = valid.map(a => a.variants);

  const priorityIndices = valid
    .map((a, i) => ({ i, p: a.sort_priority }))
    .filter(x => x.p !== 0)
    .sort((a, b) => a.p - b.p)
    .map(x => x.i);

  let combos = cartesianProduct(codeLists);
  if (priorityIndices.length > 0) {
    combos.sort((a, b) => {
      for (const idx of priorityIndices) {
        const cmp = a[idx].localeCompare(b[idx], undefined, { numeric: true, sensitivity: 'base' });
        if (cmp !== 0) return cfg.sortDirection === 'DESC' ? -cmp : cmp;
      }
      return 0;
    });
  }

  generatedSkus = combos.map(c => modelName + c.join(''));

  const counts = valid.map(a => a.variants.length).join(' × ');
  const sortedAttrs = valid.filter(a => a.sort_priority !== 0).sort((a, b) => a.sort_priority - b.sort_priority);
  const unsortedAttrs = valid.filter(a => a.sort_priority === 0);
  let sortInfo = sortedAttrs.length > 0
    ? sortedAttrs.map(a => a.name).join(' → ') + ` (${cfg.sortDirection})`
    : 'No sorting';
  if (unsortedAttrs.length > 0)
    sortInfo += ` · <span class="text-gray-400">${unsortedAttrs.map(a => a.name).join(', ')}: input order</span>`;

  document.getElementById('summary').innerHTML = `
    <div class="flex flex-wrap gap-x-6 gap-y-1 text-sm">
      <span><span class="text-gray-400">Product:</span> <strong class="text-gray-800">${modelName}</strong></span>
      <span><span class="text-gray-400">Attributes:</span> ${valid.map(a => a.name).join(', ')}</span>
      <span><span class="text-gray-400">Sort:</span> ${sortInfo}</span>
      <span><span class="text-gray-400">Variants:</span> ${counts} = <strong class="text-brand-600">${generatedSkus.length}</strong> total</span>
    </div>
  `;

  const list = document.getElementById('skuList');
  list.innerHTML = generatedSkus.map((sku, i) =>
    `<div class="sku-row flex items-center px-4 py-1.5 gap-3">
      <span class="text-gray-300 text-xs w-8 text-right shrink-0">${i + 1}</span>
      <span class="text-gray-800">${sku}</span>
    </div>`
  ).join('');

  document.getElementById('resultFooter').classList.remove('hidden');
  autoSave();
}

// ── Copy ──

function copyAll() {
  if (!generatedSkus.length) return;
  navigator.clipboard.writeText(generatedSkus.join('\n')).then(() => {
    const btn = document.querySelector('#resultFooter button');
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    btn.classList.add('bg-green-100', 'text-green-700');
    setTimeout(() => { btn.textContent = orig; btn.classList.remove('bg-green-100', 'text-green-700'); }, 1500);
  });
}

// ── Templates ──

function refreshTemplateSelect() {
  const sel = document.getElementById('templateSelect');
  const templates = getTemplates();
  const names = Object.keys(templates).sort();
  sel.innerHTML = '<option value="">— none —</option>' + names.map(n => `<option value="${n}">${n}</option>`).join('');
}

function saveTemplate() {
  const name = prompt('Template name:');
  if (!name || !name.trim()) return;
  const templates = getTemplates();
  templates[name.trim()] = getCurrentConfig();
  setTemplates(templates);
  refreshTemplateSelect();
  document.getElementById('templateSelect').value = name.trim();
}

function loadTemplate() {
  const name = document.getElementById('templateSelect').value;
  if (!name) return;
  const templates = getTemplates();
  if (!templates[name]) return;
  applyConfig(templates[name]);
}

function deleteTemplate() {
  const name = document.getElementById('templateSelect').value;
  if (!name) return;
  if (!confirm(`Delete template "${name}"?`)) return;
  const templates = getTemplates();
  delete templates[name];
  setTemplates(templates);
  refreshTemplateSelect();
}

// ── Init ──

(function init() {
  setSortDir('ASC');
  refreshTemplateSelect();
  try {
    const saved = JSON.parse(localStorage.getItem(LS_CONFIG));
    if (saved) { applyConfig(saved); }
  } catch { }
})();
