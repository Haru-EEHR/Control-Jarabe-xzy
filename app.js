let database = [];
let historialEvaluaciones = [];

document.addEventListener('DOMContentLoaded', async () => {
    await loadDatabase();
    loadHistorial();
    initTabs();
    initSearch();
    initEvaluations();
    initComparisons();
    initAdmin();
});

async function loadDatabase() {
    const localData = localStorage.getItem('lab_jarabes_db_v1');
    if (localData) {
        database = JSON.parse(localData);
    } else {
        try {
            const response = await fetch('database.json');
            database = await response.json();
            localStorage.setItem('lab_jarabes_db_v1', JSON.stringify(database));
        } catch (error) {
            console.error('Error cargando database.json:', error);
        }
    }
    populateSelects();
    renderAdminTable();
}

function loadHistorial() {
    const saved = localStorage.getItem('lab_jarabes_historial_v1');
    if (saved) {
        historialEvaluaciones = JSON.parse(saved);
    }
    renderHistorial();
}

function initTabs() {
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.getAttribute('data-tab')).classList.add('active');
        });
    });
}

function populateSelects(filterText = '') {
    const quickConsulta = document.getElementById('quickSelectConsulta');
    const evalSelect = document.getElementById('evalProductSelect');
    const comp1 = document.getElementById('compProduct1');
    const comp2 = document.getElementById('compProduct2');

    if (quickConsulta && !filterText) {
        quickConsulta.innerHTML = `<option value="">-- Todos los productos (${database.length}) --</option>`;
        database.forEach(p => {
            quickConsulta.innerHTML += `<option value="${p.id}">${p.nombre}</option>`;
        });
    }

    if (evalSelect) {
        const filtered = database.filter(p => p.nombre.toLowerCase().includes(filterText.toLowerCase()));
        evalSelect.innerHTML = `<option value="">-- Seleccione un producto (${filtered.length}) --</option>`;
        filtered.forEach(p => {
            evalSelect.innerHTML += `<option value="${p.id}">${p.nombre}</option>`;
        });
    }

    if (comp1 && comp2 && !filterText) {
        comp1.innerHTML = '<option value="">-- Seleccionar --</option>';
        comp2.innerHTML = '<option value="">-- Seleccionar --</option>';
        database.forEach(p => {
            comp1.innerHTML += `<option value="${p.id}">${p.nombre}</option>`;
            comp2.innerHTML += `<option value="${p.id}">${p.nombre}</option>`;
        });
    }
}

// Buscador y Selector en Consulta
function initSearch() {
    const searchInput = document.getElementById('searchInput');
    const suggestionsList = document.getElementById('suggestionsList');
    const quickConsulta = document.getElementById('quickSelectConsulta');

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        suggestionsList.innerHTML = '';
        if (!query) {
            suggestionsList.classList.add('hidden');
            return;
        }

        const filtered = database.filter(p => p.nombre.toLowerCase().includes(query));
        if (filtered.length > 0) {
            suggestionsList.classList.remove('hidden');
            filtered.forEach(prod => {
                const div = document.createElement('div');
                div.classList.add('suggestion-item');
                div.textContent = prod.nombre;
                div.addEventListener('click', () => {
                    searchInput.value = prod.nombre;
                    quickConsulta.value = prod.id;
                    suggestionsList.classList.add('hidden');
                    displayProductDetails(prod);
                });
                suggestionsList.appendChild(div);
            });
        } else {
            suggestionsList.classList.add('hidden');
        }
    });

    quickConsulta.addEventListener('change', (e) => {
        const prod = database.find(p => p.id === e.target.value);
        if (prod) {
            searchInput.value = prod.nombre;
            displayProductDetails(prod);
        } else {
            document.getElementById('productDetails').classList.add('hidden');
        }
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-box')) {
            suggestionsList.classList.add('hidden');
        }
    });
}

function displayProductDetails(prod) {
    document.getElementById('productDetails').classList.remove('hidden');
    document.getElementById('detNombre').textContent = prod.nombre;
    document.getElementById('detRelacion').textContent = prod.relacion_agua_jarabe || '--';
    document.getElementById('detTipo').textContent = prod.tipo_jarabe || '--';

    document.getElementById('detVolumen').textContent = prod.volumen_final ?? '--';
    document.getElementById('detPesoJarabe').textContent = prod.peso_jarabe_sensorial ?? '--';
    document.getElementById('detPesoAgua').textContent = prod.peso_agua_sensorial ?? '--';
    document.getElementById('detPesoAcidez').textContent = prod.peso_acidez_citrica ?? '--';

    const tbody = document.getElementById('paramsTableBody');
    tbody.innerHTML = '';

    const params = [
        { label: 'Sólidos Solubles (°Brix)', key: 'brix' },
        { label: 'Acidez Cítrica (g/100 ml)', key: 'acidez_citrica' },
        { label: 'Gasto de Soda (ml)', key: 'gasto_soda' },
        { label: 'Densidad (g/ml)', key: 'densidad' },
        { label: 'Acidez Fosfórica (%)', key: 'acidez_fosforica' },
        { label: 'pH', key: 'ph' }
    ];

    params.forEach(p => {
        const val = prod[p.key];
        tbody.innerHTML += `
            <tr>
                <td><strong>${p.label}</strong></td>
                <td>${val && val.min !== null ? val.min : '-'}</td>
                <td style="color: var(--accent-amber); font-weight: bold;">${val && val.nom !== null ? val.nom : '-'}</td>
                <td>${val && val.max !== null ? val.max : '-'}</td>
            </tr>`;
    });

    document.getElementById('btnExportPdf').onclick = () => window.print();
}

// Evaluación de Laboratorio + Bitácora Acumulada
function initEvaluations() {
    const evalSearch = document.getElementById('evalSearchInput');
    const evalSelect = document.getElementById('evalProductSelect');
    const labForm = document.getElementById('labEvalForm');
    const container = document.getElementById('evalInputsContainer');
    const evalResultCard = document.getElementById('evalResultCard');

    evalSearch.addEventListener('input', (e) => {
        populateSelects(e.target.value);
    });

    evalSelect.addEventListener('change', (e) => {
        const prodId = e.target.value;
        evalResultCard.classList.add('hidden');
        if (!prodId) {
            labForm.classList.add('hidden');
            return;
        }

        const prod = database.find(p => p.id === prodId);
        container.innerHTML = '';
        labForm.classList.remove('hidden');

        const params = [
            { label: '°Brix Obtenido', key: 'brix' },
            { label: 'Acidez Cítrica (g/100 ml)', key: 'acidez_citrica' },
            { label: 'Gasto de Soda (ml)', key: 'gasto_soda' },
            { label: 'Densidad (g/ml)', key: 'densidad' },
            { label: 'Acidez Fosfórica (%)', key: 'acidez_fosforica' },
            { label: 'pH Obtenido', key: 'ph' }
        ];

        params.forEach(p => {
            const spec = prod[p.key];
            const hasMin = spec && spec.min !== null;
            const hasMax = spec && spec.max !== null;
            const hasSpec = hasMin || hasMax;
            
            let rangoTexto = '(Sin especificación)';
            if (hasMin && hasMax) rangoTexto = `(Rango: ${spec.min} - ${spec.max})`;
            else if (hasMin && !hasMax) rangoTexto = `(Ref/Mín: ${spec.min})`;

            container.innerHTML += `
                <div class="form-group">
                    <label>${p.label} <span style="color:var(--accent-amber); font-weight:normal;">${rangoTexto}</span></label>
                    <input type="number" step="any" name="${p.key}" class="form-control" ${!hasSpec ? 'disabled placeholder="No aplica"' : 'placeholder="Ingresar resultado"'}>
                </div>`;
        });
    });

    document.getElementById('btnClearEvalForm').addEventListener('click', () => {
        labForm.reset();
        evalResultCard.classList.add('hidden');
    });

    labForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const prod = database.find(p => p.id === evalSelect.value);
        if (!prod) return;

        const formData = new FormData(labForm);
        const now = new Date();
        const fechaHora = now.toLocaleDateString('es-PE') + ' ' + now.toLocaleTimeString('es-PE');

        const paramsMap = {
            brix: '°Brix',
            acidez_citrica: 'Acidez Cítrica',
            gasto_soda: 'Gasto de Soda',
            densidad: 'Densidad',
            acidez_fosforica: 'Acidez Fosfórica',
            ph: 'pH'
        };

        const resultBody = document.getElementById('evalResultBody');
        resultBody.innerHTML = '';

        let detallesRegistro = [];
        let tieneFuera = false;
        let tieneEvaluados = false;

        for (let [key, label] of Object.entries(paramsMap)) {
            const spec = prod[key];
            const rawVal = formData.get(key);
            const val = (rawVal !== null && rawVal !== '') ? parseFloat(rawVal) : null;

            const hasMin = spec && spec.min !== null;
            const hasMax = spec && spec.max !== null;

            let estado = 'SIN DATO';
            let badgeClass = 'badge-sin';

            if (!hasMin && !hasMax) {
                estado = 'NO APLICA';
                badgeClass = 'badge-sin';
            } else if (val === null || isNaN(val)) {
                estado = 'SIN INGRESO';
                badgeClass = 'badge-sin';
            } else {
                tieneEvaluados = true;
                let cumpleMin = hasMin ? val >= spec.min : true;
                let cumpleMax = hasMax ? val <= spec.max : true;

                // Si solo tiene un valor de referencia en min (ej. Densidad en algunos productos), se evalúa exactitud o límite mínimo
                if (hasMin && !hasMax) {
                    cumpleMin = val >= spec.min;
                }

                if (cumpleMin && cumpleMax) {
                    estado = 'CONFORME';
                    badgeClass = 'badge-conforme';
                } else {
                    estado = 'FUERA DE ESPECIFICACIÓN';
                    badgeClass = 'badge-fuera';
                    tieneFuera = true;
                }

                detallesRegistro.push({
                    parametro: label,
                    min: spec.min ?? '-',
                    nom: spec.nom ?? '-',
                    max: spec.max ?? '-',
                    obtenido: val,
                    estado: estado
                });
            }

            resultBody.innerHTML += `
                <tr>
                    <td><strong>${label}</strong></td>
                    <td>${spec?.min ?? '-'}</td>
                    <td>${spec?.nom ?? '-'}</td>
                    <td>${spec?.max ?? '-'}</td>
                    <td><strong>${val !== null && !isNaN(val) ? val : '-'}</strong></td>
                    <td><span class="badge ${badgeClass}">${estado}</span></td>
                </tr>`;
        }

        evalResultCard.classList.remove('hidden');

        // Exportar análisis individual
        document.getElementById('btnExportSingleCsv').onclick = () => {
            let csv = '\uFEFFFecha y Hora;Producto;Parametro;Minimo;Nominal;Maximo;Obtenido;Estado\n';
            detallesRegistro.forEach(d => {
                csv += `"${fechaHora}";"${prod.nombre}";"${d.parametro}";${d.min};${d.nom};${d.max};${d.obtenido};"${d.estado}"\n`;
            });
            descargarCSV(csv, `Analisis_${prod.nombre.replace(/\s+/g, '_')}.csv`);
        };

        // Guardar en Bitácora Acumulada si se ingresó al menos 1 dato
        if (tieneEvaluados) {
            const dictamenGeneral = tieneFuera ? 'FUERA DE ESPECIFICACIÓN' : 'CONFORME';
            historialEvaluaciones.unshift({
                fechaHora,
                producto: prod.nombre,
                dictamen: dictamenGeneral,
                detalles: detallesRegistro
            });
            localStorage.setItem('lab_jarabes_historial_v1', JSON.stringify(historialEvaluaciones));
            renderHistorial();
        }
    });

    // Exportar toda la Bitácora Acumulada a Excel (CSV con BOM UTF-8 y punto y coma para Excel en español)
    document.getElementById('btnExportHistorial').addEventListener('click', () => {
        if (historialEvaluaciones.length === 0) {
            alert('No hay registros en la bitácora para exportar.');
            return;
        }
        let csv = '\uFEFFFecha y Hora;Producto;Dictamen General;Parametro;Minimo;Nominal;Maximo;Valor Obtenido;Estado Parametro\n';
        historialEvaluaciones.forEach(reg => {
            reg.detalles.forEach(d => {
                csv += `"${reg.fechaHora}";"${reg.producto}";"${reg.dictamen}";"${d.parametro}";${d.min};${d.nom};${d.max};${d.obtenido};"${d.estado}"\n`;
            });
        });
        descargarCSV(csv, `Bitacora_Acumulada_Laboratorio_${new Date().toISOString().slice(0,10)}.csv`);
    });

    document.getElementById('btnClearHistorial').addEventListener('click', () => {
        if (confirm('¿Desea limpiar todo el historial acumulado de la bitácora? Asegúrese de haberlo exportado primero.')) {
            historialEvaluaciones = [];
            localStorage.removeItem('lab_jarabes_historial_v1');
            renderHistorial();
        }
    });
}

function descargarCSV(contenido, nombreArchivo) {
    const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    a.click();
}

function renderHistorial() {
    const tbody = document.getElementById('historialTableBody');
    if (historialEvaluaciones.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: var(--secondary-text);">No hay registros en la bitácora aún.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    historialEvaluaciones.forEach(reg => {
        const badgesHtml = reg.detalles.map(d => {
            const cls = d.estado === 'CONFORME' ? 'badge-conforme' : 'badge-fuera';
            return `<span style="display:inline-block; margin: 2px 4px 2px 0;">${d.parametro}: <strong>${d.obtenido}</strong> <span class="badge ${cls}">${d.estado}</span></span>`;
        }).join(' ');

        const dictamenCls = reg.dictamen === 'CONFORME' ? 'badge-conforme' : 'badge-fuera';

        tbody.innerHTML += `
            <tr>
                <td style="white-space:nowrap;">${reg.fechaHora}</td>
                <td><strong>${reg.producto}</strong></td>
                <td>${badgesHtml}</td>
                <td><span class="badge ${dictamenCls}">${reg.dictamen}</span></td>
            </tr>`;
    });
}

// Comparación de Productos
function initComparisons() {
    document.getElementById('btnCompare').addEventListener('click', () => {
        const id1 = document.getElementById('compProduct1').value;
        const id2 = document.getElementById('compProduct2').value;
        if (!id1 || !id2) {
            alert('Seleccione dos productos para comparar.');
            return;
        }
        const p1 = database.find(p => p.id === id1);
        const p2 = database.find(p => p.id === id2);

        document.getElementById('thProd1').textContent = p1.nombre;
        document.getElementById('thProd2').textContent = p2.nombre;

        const fmtRange = obj => (obj && (obj.min !== null || obj.nom !== null)) ? `${obj.min ?? '-'} / ${obj.nom ?? '-'} / ${obj.max ?? '-'}` : '-';

        const rows = [
            { label: 'Relación Agua/Jarabe', v1: p1.relacion_agua_jarabe || '-', v2: p2.relacion_agua_jarabe || '-' },
            { label: 'Tipo de Jarabe', v1: p1.tipo_jarabe || '-', v2: p2.tipo_jarabe || '-' },
            { label: '°Brix (Mín / Nom / Máx)', v1: fmtRange(p1.brix), v2: fmtRange(p2.brix) },
            { label: 'Acidez Cítrica (Mín / Nom / Máx)', v1: fmtRange(p1.acidez_citrica), v2: fmtRange(p2.acidez_citrica) },
            { label: 'Gasto Soda (Mín / Nom / Máx)', v1: fmtRange(p1.gasto_soda), v2: fmtRange(p2.gasto_soda) },
            { label: 'Densidad (Mín / Nom / Máx)', v1: fmtRange(p1.densidad), v2: fmtRange(p2.densidad) },
            { label: 'Acidez Fosfórica (Mín / Nom / Máx)', v1: fmtRange(p1.acidez_fosforica), v2: fmtRange(p2.acidez_fosforica) },
            { label: 'pH (Mín / Nom / Máx)', v1: fmtRange(p1.ph), v2: fmtRange(p2.ph) },
            { label: 'Volumen Final', v1: p1.volumen_final ?? '-', v2: p2.volumen_final ?? '-' },
            { label: 'Peso Jarabe (Sensorial 296 mL)', v1: p1.peso_jarabe_sensorial ?? '-', v2: p2.peso_jarabe_sensorial ?? '-' },
            { label: 'Peso Agua (Sensorial 296 mL)', v1: p1.peso_agua_sensorial ?? '-', v2: p2.peso_agua_sensorial ?? '-' },
            { label: 'Peso Acidez Cítrica (g)', v1: p1.peso_acidez_citrica ?? '-', v2: p2.peso_acidez_citrica ?? '-' }
        ];

        const tbody = document.getElementById('comparisonTableBody');
        tbody.innerHTML = '';
        rows.forEach(r => {
            tbody.innerHTML += `<tr><td><strong>${r.label}</strong></td><td>${r.v1}</td><td>${r.v2}</td></tr>`;
        });
        document.getElementById('comparisonResult').classList.remove('hidden');
    });
}

// Administración DB
function initAdmin() {
    const modal = document.getElementById('productModal');
    const productForm = document.getElementById('productForm');

    document.getElementById('btnNewProduct').addEventListener('click', () => {
        document.getElementById('modalTitle').textContent = 'Agregar Nuevo Producto';
        productForm.reset();
        document.getElementById('modalProductId').value = '';
        modal.classList.remove('hidden');
    });

    document.getElementById('closeModal').addEventListener('click', () => modal.classList.add('hidden'));

    document.getElementById('btnExportJson').addEventListener('click', () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(database, null, 2));
        const a = document.createElement('a');
        a.href = dataStr;
        a.download = "database.json";
        a.click();
    });

    document.getElementById('btnResetDb').addEventListener('click', async () => {
        if (confirm('¿Confirma que desea restaurar la base de datos original? Se perderán las modificaciones locales.')) {
            localStorage.removeItem('lab_jarabes_db_v1');
            await loadDatabase();
            alert('Base de datos original restaurada.');
        }
    });

    productForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!confirm('¿Confirma que desea guardar estos cambios en la base de datos?')) return;

        const idVal = document.getElementById('modalProductId').value;
        const nombre = document.getElementById('formNombre').value.trim();
        const id = idVal || nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-');

        const parseNum = idEl => {
            const v = document.getElementById(idEl).value;
            return v !== '' && !isNaN(v) ? parseFloat(v) : null;
        };

        const prodObj = {
            id,
            nombre,
            relacion_agua_jarabe: document.getElementById('formRelacion').value.trim(),
            tipo_jarabe: document.getElementById('formTipo').value.trim(),
            brix: { min: parseNum('formBrixMin'), nom: parseNum('formBrixNom'), max: parseNum('formBrixMax') },
            acidez_citrica: { min: parseNum('formAcCitMin'), nom: parseNum('formAcCitNom'), max: parseNum('formAcCitMax') },
            gasto_soda: { min: parseNum('formSodaMin'), nom: parseNum('formSodaNom'), max: parseNum('formSodaMax') },
            densidad: { min: parseNum('formDensMin'), nom: parseNum('formDensNom'), max: parseNum('formDensMax') },
            acidez_fosforica: { min: parseNum('formAcFosMin'), nom: parseNum('formAcFosNom'), max: parseNum('formAcFosMax') },
            ph: { min: parseNum('formPhMin'), nom: parseNum('formPhNom'), max: parseNum('formPhMax') },
            volumen_final: parseNum('formVolFinal'),
            peso_jarabe_sensorial: parseNum('formPesoJarabe'),
            peso_agua_sensorial: parseNum('formPesoAgua'),
            peso_acidez_citrica: parseNum('formPesoAcCit')
        };

        const idx = database.findIndex(p => p.id === id);
        if (idx >= 0) database[idx] = prodObj;
        else database.push(prodObj);

        localStorage.setItem('lab_jarabes_db_v1', JSON.stringify(database));
        modal.classList.add('hidden');
        populateSelects();
        renderAdminTable();
    });
}

function renderAdminTable() {
    const tbody = document.getElementById('adminTableBody');
    tbody.innerHTML = '';
    database.forEach(p => {
        tbody.innerHTML += `
            <tr>
                <td><strong>${p.nombre}</strong></td>
                <td>${p.relacion_agua_jarabe || '-'}</td>
                <td>${p.tipo_jarabe || '-'}</td>
                <td>${p.volumen_final ?? '-'}</td>
                <td>
                    <button class="btn btn-secondary" onclick="editProduct('${p.id}')"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn btn-secondary" style="color:var(--danger-red);" onclick="deleteProduct('${p.id}')"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>`;
    });
}

window.editProduct = function(id) {
    const p = database.find(item => item.id === id);
    if (!p) return;
    document.getElementById('modalTitle').textContent = 'Editar Producto';
    document.getElementById('modalProductId').value = p.id;
    document.getElementById('formNombre').value = p.nombre;
    document.getElementById('formRelacion').value = p.relacion_agua_jarabe || '';
    document.getElementById('formTipo').value = p.tipo_jarabe || '';

    document.getElementById('formBrixMin').value = p.brix?.min ?? '';
    document.getElementById('formBrixNom').value = p.brix?.nom ?? '';
    document.getElementById('formBrixMax').value = p.brix?.max ?? '';

    document.getElementById('formAcCitMin').value = p.acidez_citrica?.min ?? '';
    document.getElementById('formAcCitNom').value = p.acidez_citrica?.nom ?? '';
    document.getElementById('formAcCitMax').value = p.acidez_citrica?.max ?? '';

    document.getElementById('formSodaMin').value = p.gasto_soda?.min ?? '';
    document.getElementById('formSodaNom').value = p.gasto_soda?.nom ?? '';
    document.getElementById('formSodaMax').value = p.gasto_soda?.max ?? '';

    document.getElementById('formDensMin').value = p.densidad?.min ?? '';
    document.getElementById('formDensNom').value = p.densidad?.nom ?? '';
    document.getElementById('formDensMax').value = p.densidad?.max ?? '';

    document.getElementById('formAcFosMin').value = p.acidez_fosforica?.min ?? '';
    document.getElementById('formAcFosNom').value = p.acidez_fosforica?.nom ?? '';
    document.getElementById('formAcFosMax').value = p.acidez_fosforica?.max ?? '';

    document.getElementById('formPhMin').value = p.ph?.min ?? '';
    document.getElementById('formPhNom').value = p.ph?.nom ?? '';
    document.getElementById('formPhMax').value = p.ph?.max ?? '';

    document.getElementById('formVolFinal').value = p.volumen_final ?? '';
    document.getElementById('formPesoJarabe').value = p.peso_jarabe_sensorial ?? '';
    document.getElementById('formPesoAgua').value = p.peso_agua_sensorial ?? '';
    document.getElementById('formPesoAcCit').value = p.peso_acidez_citrica ?? '';

    document.getElementById('productModal').classList.remove('hidden');
};

window.deleteProduct = function(id) {
    if (confirm('¿Confirma que desea eliminar este producto de la base de datos?')) {
        database = database.filter(p => p.id !== id);
        localStorage.setItem('lab_jarabes_db_v1', JSON.stringify(database));
        populateSelects();
        renderAdminTable();
    }
};
