const templates = [
    { name: "NOCTURNO (SEX/SÁB)",      j1: "03 Jul, 19:00", j2: "10 Jul, 20:30", j3: "19 Jul, 10:00" },
    { name: "MATINAL (SÁB/DOM)",        j1: "04 Jul, 10:00", j2: "11 Jul, 11:30", j3: "19 Jul, 11:30" },
    { name: "AFTER-WORK (SEG/QUA)",     j1: "06 Jul, 19:30", j2: "13 Jul, 19:30", j3: "19 Jul, 13:00" },
    { name: "WEEKEND PRIME (SÁB/DOM)",  j1: "04 Jul, 16:00", j2: "11 Jul, 17:30", j3: "19 Jul, 14:30" }
];

const poteConfigs = [
    { label: "POTE 1 (C.S.)", num: 1 },
    { label: "POTE 2",        num: 2 },
    { label: "POTE 3",        num: 3 },
    { label: "POTE 4",        num: 4 }
];

// ── localStorage ──

function storageKey(group, pote) {
    return `vaga_${group}_pote${pote}`;
}

function loadVaga(group, pote) {
    const raw = localStorage.getItem(storageKey(group, pote));
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
}

function saveVaga(group, pote, data) {
    localStorage.setItem(storageKey(group, pote), JSON.stringify(data));
}

function clearVaga(group, pote) {
    localStorage.removeItem(storageKey(group, pote));
}

function esc(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// ── HTML generation ──

function buildOverlayContent(data) {
    return `
        <div class="overlay-names">${esc(data.jogador1)} &amp; ${esc(data.jogador2)}</div>
        <div class="overlay-contact">${esc(data.contacto)}</div>`;
}

function buildPoteRow(groupLetter, pote, campos, template) {
    const data = loadVaga(groupLetter, pote.num);
    const closed = data !== null;

    return `
        <div class="pote-row${closed ? ' closed' : ''}">
            <div class="pote-main">
                <div class="pote-header">${pote.label}</div>
                <div class="games-container">
                    <div class="game-box">
                        <span>J1: ${template.j1}</span>
                        <strong>Campo ${campos.c1}</strong>
                    </div>
                    <div class="game-box">
                        <span>J2: ${template.j2}</span>
                        <strong>Campo ${campos.c2}</strong>
                    </div>
                    <div class="game-box">
                        <span>J3: ${template.j3}</span>
                        <strong>Campo ${campos.c3}</strong>
                        <em>SIMULTÂNEO</em>
                    </div>
                </div>
                <button class="btn-toggle${closed ? ' closed-btn' : ''}"
                        data-group="${groupLetter}"
                        data-pote="${pote.num}">
                    ${closed ? 'Abrir Vaga' : 'Fechar Vaga'}
                </button>
            </div>
            <div class="vaga-form hidden">
                <input class="vaga-input" type="text" placeholder="Jogador 1" autocomplete="off" />
                <input class="vaga-input" type="text" placeholder="Jogador 2" autocomplete="off" />
                <input class="vaga-input" type="text" placeholder="Contacto" autocomplete="off" />
                <div class="form-actions">
                    <button class="btn-confirm">Confirmar</button>
                    <button class="btn-cancel">Cancelar</button>
                </div>
            </div>
            <div class="vaga-overlay${closed ? '' : ' hidden'}">
                ${closed ? buildOverlayContent(data) : ''}
            </div>
        </div>`;
}

function buildGroupCard(groupLetter, offset, templateIndex) {
    const template = templates[templateIndex];
    const f1 = 1 + offset;
    const f2 = 2 + offset;
    const f3 = 3 + offset;

    const camposPorPote = [
        { c1: f1, c2: f2, c3: f1 },
        { c1: f1, c2: f3, c3: f1 },
        { c1: f1, c2: f2, c3: f2 },
        { c1: f1, c2: f3, c3: f2 }
    ];

    const rows = poteConfigs
        .map((pote, i) => buildPoteRow(groupLetter, pote, camposPorPote[i], template))
        .join('');

    return `
        <div class="group-card">
            <div class="group-title">
                GRUPO ${groupLetter}
                <span class="template-name">${template.name}</span>
            </div>
            ${rows}
        </div>`;
}

// ── State transitions ──

function applyClose(row, btn, group, pote, data) {
    row.classList.add('closed');
    btn.textContent = 'Abrir Vaga';
    btn.classList.add('closed-btn');

    const overlay = row.querySelector('.vaga-overlay');
    overlay.innerHTML = buildOverlayContent(data);
    overlay.classList.remove('hidden');

    saveVaga(group, pote, data);
}

function applyOpen(row, btn, group, pote) {
    row.classList.remove('closed');
    btn.textContent = 'Fechar Vaga';
    btn.classList.remove('closed-btn');

    const overlay = row.querySelector('.vaga-overlay');
    overlay.classList.add('hidden');
    overlay.innerHTML = '';

    clearVaga(group, pote);
}

// ── Event listeners ──

function attachListeners() {
    document.querySelectorAll('.btn-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const row = btn.closest('.pote-row');
            const { group, pote } = btn.dataset;

            if (row.classList.contains('closed')) {
                applyOpen(row, btn, group, pote);
                return;
            }

            // Toggle inline form
            const form = row.querySelector('.vaga-form');
            const isHidden = form.classList.toggle('hidden');
            if (!isHidden) form.querySelector('.vaga-input').focus();
        });
    });

    document.querySelectorAll('.btn-confirm').forEach(btn => {
        btn.addEventListener('click', () => confirmForm(btn.closest('.pote-row')));
    });

    // Submit on Enter from any input
    document.querySelectorAll('.vaga-form').forEach(form => {
        form.querySelectorAll('.vaga-input').forEach(input => {
            input.addEventListener('keydown', e => {
                if (e.key === 'Enter') confirmForm(form.closest('.pote-row'));
            });
        });
    });

    document.querySelectorAll('.btn-cancel').forEach(btn => {
        btn.addEventListener('click', () => {
            const form = btn.closest('.vaga-form');
            form.querySelectorAll('.vaga-input').forEach(i => (i.value = ''));
            form.classList.add('hidden');
        });
    });
}

function confirmForm(row) {
    const toggleBtn = row.querySelector('.btn-toggle');
    const { group, pote } = toggleBtn.dataset;
    const inputs = row.querySelectorAll('.vaga-input');
    const jogador1 = inputs[0].value.trim();
    const jogador2 = inputs[1].value.trim();
    const contacto = inputs[2].value.trim();

    if (!jogador1) { inputs[0].focus(); return; }
    if (!jogador2) { inputs[1].focus(); return; }

    row.querySelector('.vaga-form').classList.add('hidden');
    inputs.forEach(i => (i.value = ''));

    applyClose(row, toggleBtn, group, pote, { jogador1, jogador2, contacto });
}

// ── Bootstrap ──

async function init() {
    const res = await fetch('data/grupos.json');
    const { clubes } = await res.json();

    clubes.forEach(clube => {
        const grid = document.getElementById(clube.gridId);
        clube.grupos.forEach((letra, i) => {
            const templateIndex = (i + clube.templateOffset) % templates.length;
            grid.innerHTML += buildGroupCard(letra, clube.offset, templateIndex);
        });
    });

    attachListeners();
}

init();
