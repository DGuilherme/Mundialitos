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

function storageKey(groupLetter, poteNum) {
    return `vaga_${groupLetter}_pote${poteNum}`;
}

function isClosed(groupLetter, poteNum) {
    return localStorage.getItem(storageKey(groupLetter, poteNum)) === 'closed';
}

function toggleVaga(btn) {
    const row = btn.closest('.pote-row');
    const { group, pote } = btn.dataset;
    const closed = row.classList.toggle('closed');
    btn.textContent = closed ? 'Abrir Vaga' : 'Fechar Vaga';
    btn.classList.toggle('closed-btn', closed);
    localStorage.setItem(storageKey(group, pote), closed ? 'closed' : 'open');
}

function buildPoteRow(groupLetter, pote, campos, template) {
    const closed = isClosed(groupLetter, pote.num);
    return `
        <div class="pote-row${closed ? ' closed' : ''}">
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
        </div>`;
}

function buildGroupCard(groupLetter, offset, templateIndex) {
    const template = templates[templateIndex];
    const f1 = 1 + offset;
    const f2 = 2 + offset;
    const f3 = 3 + offset;

    // Campo assignment per pote: J3 is always simultaneous within the group (f1/f2)
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

function attachListeners() {
    document.querySelectorAll('.btn-toggle').forEach(btn => {
        btn.addEventListener('click', () => toggleVaga(btn));
    });
}

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
