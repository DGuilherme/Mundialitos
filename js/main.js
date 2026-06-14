import { initializeApp }                                  from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js';
import { getDatabase, ref, set, remove, onValue }         from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js';
import { firebaseConfig }                                  from './firebase-config.js';

const app     = initializeApp(firebaseConfig);
const db      = getDatabase(app);
const isAdmin = sessionStorage.getItem('mundialitos_admin') === '1';

// ── Static data ──
// Fase de Grupos: 2 semanas (weekends de 3-4 Jul e 10-11 Jul)
// Só sextas 18h-00h e sábados 09h-00h

const templates = [
    { name: "NOCTURNO (SEX)",  j1: "Sex. 03 Jul, 20:00", j2: "Sex. 10 Jul, 20:00", j3: "Sex. 10 Jul, 22:00" },
    { name: "MATINAL (SÁB)",   j1: "Sáb. 04 Jul, 09:00", j2: "Sáb. 11 Jul, 09:00", j3: "Sáb. 11 Jul, 11:00" },
    { name: "TARDE (SÁB)",     j1: "Sáb. 04 Jul, 15:00", j2: "Sex. 10 Jul, 18:00", j3: "Sáb. 11 Jul, 15:00" },
    { name: "MISTO (SEX/SÁB)", j1: "Sex. 03 Jul, 18:00", j2: "Sáb. 04 Jul, 12:00", j3: "Sex. 10 Jul, 21:00" }
];

const poteConfigs = [
    { label: "M3", num: 1, nivel: "M3" },
    { label: "M4", num: 2, nivel: "M4" },
    { label: "M5", num: 3, nivel: "M5" },
    { label: "M6", num: 4, nivel: "M6" }
];

// Populated during init — maps group letter to template index
const groupTemplateMap = {};

// Cache of custom schedules from Firebase — group letter -> { j1, j2, j3 }
const customSchedules = {};

// ── Firebase helpers ──

function dbKey(group, pote) { return `${group}_${pote}`; }

function writeVaga(group, pote, data)  { return set(ref(db, `vagas/${dbKey(group, pote)}`), data); }
function deleteVaga(group, pote)       { return remove(ref(db, `vagas/${dbKey(group, pote)}`)); }
function writeSchedule(group, data)    { return set(ref(db, `schedules/${group}`), data); }
function deleteSchedule(group)         { return remove(ref(db, `schedules/${group}`)); }
function writeRegulamento(html)        { return set(ref(db, 'regulamento'), { html }); }

// ── Utils ──

function esc(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function getSchedule(group) {
    return customSchedules[group] || templates[groupTemplateMap[group] || 0];
}

// ── HTML generation ──

function buildPoteRow(groupLetter, pote, campos, template) {
    return `
        <div class="pote-row" data-group="${groupLetter}" data-pote="${pote.num}" data-nivel="${pote.nivel}">
            <div class="pote-main">
                <div class="pote-header">${pote.label}</div>
                <div class="games-container">
                    <div class="game-box">
                        <strong>Jogo 1</strong>
                        <span data-group="${groupLetter}" data-jornada="j1">${template.j1}</span>
                    </div>
                    <div class="game-box">
                        <strong>Jogo 2</strong>
                        <span data-group="${groupLetter}" data-jornada="j2">${template.j2}</span>
                    </div>
                    <div class="game-box">
                        <strong>Jogo 3</strong>
                        <span data-group="${groupLetter}" data-jornada="j3">${template.j3}</span>
                    </div>
                </div>
                <div class="btn-group">
                    <button class="btn-toggle">Fechar Vaga</button>
                    ${isAdmin ? '<button class="btn-edit hidden">Editar</button>' : ''}
                </div>
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

    const scheduleForm = isAdmin ? `
        <div class="schedule-form hidden">
            <div class="schedule-fields">
                <div class="schedule-field">
                    <label>J1</label>
                    <input class="vaga-input schedule-input" data-jornada="j1" type="text" placeholder="${template.j1}" />
                </div>
                <div class="schedule-field">
                    <label>J2</label>
                    <input class="vaga-input schedule-input" data-jornada="j2" type="text" placeholder="${template.j2}" />
                </div>
                <div class="schedule-field">
                    <label>J3</label>
                    <input class="vaga-input schedule-input" data-jornada="j3" type="text" placeholder="${template.j3}" />
                </div>
            </div>
            <div class="form-actions">
                <button class="btn-confirm btn-save-schedule">Guardar</button>
                <button class="btn-cancel btn-reset-schedule">Repor Padrão</button>
                <button class="btn-cancel btn-cancel-schedule">Cancelar</button>
            </div>
        </div>` : '';

    return `
        <div class="group-card" data-group="${groupLetter}">
            <div class="group-title">
                GRUPO ${groupLetter}
                <div class="group-title-right">
                    <span class="template-name" data-group="${groupLetter}">${template.name}</span>
                    ${isAdmin ? `<button class="btn-edit-schedule" data-group="${groupLetter}">✎ Horários</button>` : ''}
                </div>
            </div>
            ${scheduleForm}
            ${rows}
        </div>`;
}

// ── Real-time: vagas ──

function applyRowState(row, data) {
    const btn     = row.querySelector('.btn-toggle');
    const editBtn = row.querySelector('.btn-edit');
    const overlay = row.querySelector('.vaga-overlay');
    const isClosed = data !== null;

    row.classList.toggle('closed', isClosed);
    btn.textContent = isClosed ? (isAdmin ? 'Abrir Vaga' : 'Vaga Ocupada') : 'Fechar Vaga';
    btn.classList.toggle('closed-btn', isClosed);
    btn.disabled = isClosed && !isAdmin;
    if (editBtn) editBtn.classList.toggle('hidden', !isClosed);

    if (isClosed) {
        row.dataset.vagaData = JSON.stringify(data);
        overlay.innerHTML = `
            <div class="overlay-names">${esc(data.jogador1)} &amp; ${esc(data.jogador2)}</div>
            <div class="overlay-contact">${esc(data.contacto)}</div>`;
        overlay.classList.remove('hidden');
    } else {
        delete row.dataset.vagaData;
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

// ── Real-time: schedules ──

function applySchedule(group, schedule) {
    ['j1', 'j2', 'j3'].forEach(jornada => {
        document.querySelectorAll(`span[data-group="${group}"][data-jornada="${jornada}"]`).forEach(span => {
            span.textContent = schedule[jornada];
        });
    });

    const nameEl = document.querySelector(`.template-name[data-group="${group}"]`);
    if (nameEl) {
        nameEl.textContent = customSchedules[group]
            ? 'PERSONALIZADO'
            : templates[groupTemplateMap[group] || 0].name;
    }
}

function watchSchedules() {
    onValue(ref(db, 'schedules'), snapshot => {
        const data = snapshot.val() || {};

        // Reset cache, then apply each group
        Object.keys(customSchedules).forEach(k => delete customSchedules[k]);
        Object.assign(customSchedules, data);

        // Apply to all groups (custom or default)
        Object.keys(groupTemplateMap).forEach(group => {
            applySchedule(group, getSchedule(group));
        });
    });
}

// ── Event handling: vagas ──

function openForm(row, prefill = null) {
    const form   = row.querySelector('.vaga-form');
    const inputs = row.querySelectorAll('.vaga-input:not(.schedule-input)');
    inputs.forEach((input, i) => {
        input.value = prefill ? [prefill.jogador1, prefill.jogador2, prefill.contacto][i] || '' : '';
    });
    form.classList.remove('hidden');
    inputs[0].focus();
}

function confirmVagaForm(row) {
    const inputs   = row.querySelectorAll('.vaga-input:not(.schedule-input)');
    const jogador1 = inputs[0].value.trim();
    const jogador2 = inputs[1].value.trim();
    const contacto = inputs[2].value.trim();

    if (!jogador1) { inputs[0].focus(); return; }
    if (!jogador2) { inputs[1].focus(); return; }

    const { group, pote } = row.dataset;
    row.querySelector('.vaga-form').classList.add('hidden');
    inputs.forEach(i => (i.value = ''));
    writeVaga(group, pote, { jogador1, jogador2, contacto });
}

// ── Event handling: schedules (admin only) ──

function openScheduleForm(card) {
    const group   = card.dataset.group;
    const form    = card.querySelector('.schedule-form');
    const inputs  = card.querySelectorAll('.schedule-input');
    const current = getSchedule(group);

    inputs.forEach(input => {
        input.value = current[input.dataset.jornada] || '';
    });

    form.classList.toggle('hidden');
    if (!form.classList.contains('hidden')) inputs[0].focus();
}

function saveSchedule(card) {
    const group  = card.dataset.group;
    const inputs = card.querySelectorAll('.schedule-input');
    const def    = templates[groupTemplateMap[group] || 0];
    const data   = {};

    inputs.forEach(input => {
        data[input.dataset.jornada] = input.value.trim() || def[input.dataset.jornada];
    });

    writeSchedule(group, data);
    card.querySelector('.schedule-form').classList.add('hidden');
}

function resetSchedule(card) {
    const group = card.dataset.group;
    deleteSchedule(group);
    card.querySelector('.schedule-form').classList.add('hidden');
}

// ── Attach all listeners ──

function attachListeners() {
    // Vaga toggle
    document.querySelectorAll('.btn-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const row = btn.closest('.pote-row');
            const { group, pote } = row.dataset;

            if (row.classList.contains('closed')) {
                if (isAdmin) deleteVaga(group, pote);
                return;
            }

            const form = row.querySelector('.vaga-form');
            const isHidden = form.classList.toggle('hidden');
            if (!isHidden) openForm(row);
        });
    });

    // Vaga edit (admin)
    document.querySelectorAll('.btn-edit').forEach(btn => {
        if (!isAdmin) return;
        btn.addEventListener('click', () => {
            const row  = btn.closest('.pote-row');
            const data = row.dataset.vagaData ? JSON.parse(row.dataset.vagaData) : null;
            openForm(row, data);
        });
    });

    // Vaga form confirm / cancel
    document.querySelectorAll('.btn-confirm').forEach(btn => {
        if (btn.classList.contains('btn-save-schedule')) return;
        btn.addEventListener('click', () => confirmVagaForm(btn.closest('.pote-row')));
    });

    document.querySelectorAll('.vaga-form').forEach(form => {
        form.querySelectorAll('.vaga-input:not(.schedule-input)').forEach(input => {
            input.addEventListener('keydown', e => {
                if (e.key === 'Enter') confirmVagaForm(form.closest('.pote-row'));
            });
        });
    });

    document.querySelectorAll('.btn-cancel').forEach(btn => {
        if (btn.classList.contains('btn-reset-schedule') || btn.classList.contains('btn-cancel-schedule')) return;
        btn.addEventListener('click', () => {
            const form = btn.closest('.vaga-form');
            form.querySelectorAll('.vaga-input:not(.schedule-input)').forEach(i => (i.value = ''));
            form.classList.add('hidden');
        });
    });

    // Schedule edit (admin)
    document.querySelectorAll('.btn-edit-schedule').forEach(btn => {
        if (!isAdmin) return;
        btn.addEventListener('click', () => openScheduleForm(btn.closest('.group-card')));
    });

    document.querySelectorAll('.btn-save-schedule').forEach(btn => {
        if (!isAdmin) return;
        btn.addEventListener('click', () => saveSchedule(btn.closest('.group-card')));
    });

    document.querySelectorAll('.btn-reset-schedule').forEach(btn => {
        if (!isAdmin) return;
        btn.addEventListener('click', () => resetSchedule(btn.closest('.group-card')));
    });

    document.querySelectorAll('.btn-cancel-schedule').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.schedule-form').classList.add('hidden');
        });
    });
}

// ── Level filter ──

function applyFilter() {
    const active = new Set(
        [...document.querySelectorAll('.filter-btn.active')].map(b => b.dataset.nivel)
    );

    document.querySelectorAll('.pote-row[data-nivel]').forEach(row => {
        row.classList.toggle('nivel-hidden', !active.has(row.dataset.nivel));
    });

    document.querySelectorAll('.group-card').forEach(card => {
        const hasVisible = [...card.querySelectorAll('.pote-row')].some(r => !r.classList.contains('nivel-hidden'));
        card.classList.toggle('nivel-hidden', !hasVisible);
    });
}

function initFilter() {
    const btns = [...document.querySelectorAll('.filter-btn')];

    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            const isSoleActive = btn.classList.contains('active') &&
                btns.filter(b => b.classList.contains('active')).length === 1;

            if (isSoleActive) {
                btns.forEach(b => b.classList.add('active'));
            } else {
                btns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            }
            applyFilter();
        });
    });
    applyFilter();
}

// ── Admin bar ──

function renderAdminBar() {
    const bar = document.getElementById('admin-bar');
    if (!bar) return;

    if (isAdmin) {
        bar.innerHTML = `
            <div class="admin-bar">
                <span class="admin-badge">ADMIN</span>
                <button class="admin-logout" id="btn-logout">Sair</button>
            </div>`;
        document.getElementById('btn-logout').addEventListener('click', () => {
            sessionStorage.removeItem('mundialitos_admin');
            window.location.reload();
        });
    }
}

// ── Regulamento & Prémios ──

function watchRegulamento() {
    onValue(ref(db, 'regulamento'), snapshot => {
        const data    = snapshot.val();
        const display = document.getElementById('regulamento-display');
        if (display) display.innerHTML = data?.html || '<p class="reg-empty">Conteúdo em breve…</p>';
    });
}

function renderRegulamentoAdmin() {
    const container = document.getElementById('regulamento-admin');
    if (!container || !isAdmin) return;

    container.innerHTML = `
        <button class="btn-edit-reg" id="btn-open-reg-editor">✎ Editar</button>
        <div class="rte-wrap hidden" id="rte-wrap">
            <div class="rte-toolbar">
                <button type="button" class="rte-btn" data-cmd="bold"                title="Negrito"><b>B</b></button>
                <button type="button" class="rte-btn" data-cmd="italic"              title="Itálico"><i>I</i></button>
                <button type="button" class="rte-btn" data-cmd="underline"           title="Sublinhado"><u>U</u></button>
                <span class="rte-sep"></span>
                <button type="button" class="rte-btn" data-cmd="insertUnorderedList" title="Lista">&#8226; Lista</button>
                <button type="button" class="rte-btn" data-cmd="insertOrderedList"   title="Lista numerada">1. Lista</button>
                <span class="rte-sep"></span>
                <button type="button" class="rte-btn" data-cmd="removeFormat"        title="Remover formatação">&#10005; Formato</button>
            </div>
            <div class="rte-editor" id="rte-editor" contenteditable="true"></div>
            <div class="rte-actions">
                <button type="button" class="btn-confirm" id="btn-save-reg">Guardar</button>
                <button type="button" class="btn-cancel"  id="btn-cancel-reg">Cancelar</button>
            </div>
        </div>`;

    const openBtn  = document.getElementById('btn-open-reg-editor');
    const wrap     = document.getElementById('rte-wrap');
    const editor   = document.getElementById('rte-editor');
    const saveBtn  = document.getElementById('btn-save-reg');
    const cancelBtn = document.getElementById('btn-cancel-reg');

    openBtn.addEventListener('click', () => {
        const current = document.getElementById('regulamento-display').innerHTML;
        editor.innerHTML = current.includes('reg-empty') ? '' : current;
        wrap.classList.remove('hidden');
        openBtn.classList.add('hidden');
        editor.focus();
    });

    wrap.querySelectorAll('.rte-btn[data-cmd]').forEach(btn => {
        btn.addEventListener('mousedown', e => {
            e.preventDefault();
            document.execCommand(btn.dataset.cmd, false, null);
            editor.focus();
        });
    });

    saveBtn.addEventListener('click', () => {
        const html = editor.innerHTML;
        saveBtn.disabled = true;
        saveBtn.textContent = 'A guardar…';
        writeRegulamento(html)
            .then(() => {
                wrap.classList.add('hidden');
                openBtn.classList.remove('hidden');
            })
            .catch(err => {
                console.error('Erro ao guardar regulamento:', err);
                alert('Erro ao guardar. Verifica as permissões do Firebase.');
            })
            .finally(() => {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Guardar';
            });
    });

    cancelBtn.addEventListener('click', () => {
        wrap.classList.add('hidden');
        openBtn.classList.remove('hidden');
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
            groupTemplateMap[letra] = templateIndex;
            grid.innerHTML += buildGroupCard(letra, clube.offset, templateIndex);
        });
    });

    renderAdminBar();
    initFilter();
    attachListeners();
    watchVagas();
    watchSchedules();
    watchRegulamento();
    renderRegulamentoAdmin();
}

init();
