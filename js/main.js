import { initializeApp }                          from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js';
import { getDatabase, ref, set, remove, onValue } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js';
import { firebaseConfig }                          from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);

// ── Static data ──

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

// ── Firebase helpers ──

function dbKey(group, pote) {
    return `${group}_${pote}`;
}

function writeVaga(group, pote, data) {
    return set(ref(db, `vagas/${dbKey(group, pote)}`), data);
}

function deleteVaga(group, pote) {
    return remove(ref(db, `vagas/${dbKey(group, pote)}`));
}

// ── Utils ──

function esc(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// ── HTML generation (all rows start as open; onValue sets real state) ──

function buildPoteRow(groupLetter, pote, campos, template) {
    return `
        <div class="pote-row" data-group="${groupLetter}" data-pote="${pote.num}">
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
                <button class="btn-toggle">Fechar Vaga</button>
            </div>
            <div class="vaga-form hidden">
                <input class="vaga-input" type="text" placeholder="Jogador 1" autocomplete="off" />
                <input class="vaga-input" type="text" placeholder="Jogador 2" autocomplete="off" />
                <input class="vaga-input" type="text" placeholder="Contacto"  autocomplete="off" />
                <div class="form-actions">
                    <button class="btn-confirm">Confirmar</button>
                    <button class="btn-cancel">Cancelar</button>
                </div>
            </div>
            <div class="vaga-overlay hidden"></div>
        </div>`;
}

function buildGroupCard(groupLetter, offset, templateIndex) {
    const template = templates[templateIndex];
    const f1 = 1 + offset, f2 = 2 + offset, f3 = 3 + offset;

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

// ── Real-time state sync ──

function applyRowState(row, data) {
    const btn     = row.querySelector('.btn-toggle');
    const overlay = row.querySelector('.vaga-overlay');
    const isClosed = data !== null;

    row.classList.toggle('closed', isClosed);
    btn.textContent = isClosed ? 'Abrir Vaga' : 'Fechar Vaga';
    btn.classList.toggle('closed-btn', isClosed);

    if (isClosed) {
        overlay.innerHTML = `
            <div class="overlay-names">${esc(data.jogador1)} &amp; ${esc(data.jogador2)}</div>
            <div class="overlay-contact">${esc(data.contacto)}</div>`;
        overlay.classList.remove('hidden');
    } else {
        overlay.innerHTML = '';
        overlay.classList.add('hidden');
        row.querySelector('.vaga-form').classList.add('hidden');
    }
}

function watchVagas() {
    onValue(ref(db, 'vagas'), snapshot => {
        const vagas = snapshot.val() || {};
        document.querySelectorAll('.pote-row').forEach(row => {
            const { group, pote } = row.dataset;
            applyRowState(row, vagas[dbKey(group, pote)] ?? null);
        });
    });
}

// ── Event handling ──

function confirmForm(row) {
    const inputs   = row.querySelectorAll('.vaga-input');
    const jogador1 = inputs[0].value.trim();
    const jogador2 = inputs[1].value.trim();
    const contacto = inputs[2].value.trim();

    if (!jogador1) { inputs[0].focus(); return; }
    if (!jogador2) { inputs[1].focus(); return; }

    const { group, pote } = row.dataset;
    row.querySelector('.vaga-form').classList.add('hidden');
    inputs.forEach(i => (i.value = ''));

    writeVaga(group, pote, { jogador1, jogador2, contacto });
    // onValue listener handles the visual update automatically
}

function attachListeners() {
    document.querySelectorAll('.btn-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const row = btn.closest('.pote-row');
            const { group, pote } = row.dataset;

            if (row.classList.contains('closed')) {
                deleteVaga(group, pote);
                return;
            }

            const form = row.querySelector('.vaga-form');
            const isHidden = form.classList.toggle('hidden');
            if (!isHidden) form.querySelector('.vaga-input').focus();
        });
    });

    document.querySelectorAll('.btn-confirm').forEach(btn => {
        btn.addEventListener('click', () => confirmForm(btn.closest('.pote-row')));
    });

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
    watchVagas();
}

init();
