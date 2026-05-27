import { fetchDashboardData, crearObligacion, crearTransaccion, actualizarRegistro, eliminarRegistro } from './api.js';

// 0. Variables globales para el control de la SPA (Cuentas, Obligaciones, Historial, Calendario)
let todasObligaciones = [];
let transaccionesHistorial = [];
let todasCuentas = [];
let calendarioMesActual = new Date().getMonth();
let calendarioAnioActual = new Date().getFullYear();
let seccionActiva = 'inicio';

// 1. Efecto visual interactivo en los paneles glassmorphism (Brillo dinámico)
document.querySelectorAll('.glass-panel').forEach(card => {
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        card.style.setProperty('--mouse-x', `${x}px`);
        card.style.setProperty('--mouse-y', `${y}px`);
    });
});

// 2. Manejo dinámico de la fecha actual en el Header
const dateElement = document.querySelector('p.text-on-surface-variant.font-body-md');
if (dateElement) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const today = new Date();
    const formatted = today.toLocaleDateString('es-ES', options);
    dateElement.textContent = formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

// Formateador de moneda de doble propósito
const formatoMoneda = (valor) => {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0
    }).format(valor);
};

// 3. FUNCIÓN PRINCIPAL: Cargar y renderizar datos desde la base de datos
async function cargarDashboard() {
    const data = await fetchDashboardData();
    if (!data) return;

    // Guardar en los arrays globales de la SPA
    todasObligaciones = data.obligaciones || [];
    transaccionesHistorial = data.transaccionesHistorial || [];
    todasCuentas = data.cuentas || [];

    // B. Renderizar Indicadores Superiores
    document.getElementById('balance-html').textContent = formatoMoneda(data.balanceTotal);
    document.getElementById('deudas-totales-html').textContent = formatoMoneda(data.deudasTotales);

    // C. Métrica Comparativa Inteligente (Primer mes de registro vs Comparación real)
    const lastMonthMetricContainer = document.getElementById('last-month-metric-container');
    if (lastMonthMetricContainer) {
        if (!data.actividadReciente || data.actividadReciente.length === 0) {
            lastMonthMetricContainer.innerHTML = `
                <span class="px-2.5 py-1 rounded-full bg-primary/15 text-primary font-label-sm text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                    ✨ Primer mes de registro
                </span>
            `;
        } else {
            lastMonthMetricContainer.innerHTML = `
                <span class="text-green-400 flex items-center gap-1 font-label-md text-label-md">
                    <span class="material-symbols-outlined text-[14px]">trending_up</span> +12.5%
                </span>
                <span class="text-on-surface-variant font-label-md text-label-md">vs mes anterior</span>
            `;
        }
    }

    // D. Renderizar Barra de Progreso y Porcentaje de Límite de Deuda
    const limiteMaximo = 1000000; // Límite de deuda máximo ($1,000,000 COP)
    const porcentajeDeuda = Math.min((data.deudasTotales / limiteMaximo) * 100, 100);
    
    const barraProgresoDeudas = document.getElementById('barra-progreso-deudas');
    const porcentajeLimiteTexto = document.getElementById('porcentaje-limite-texto');
    
    if (barraProgresoDeudas) {
        barraProgresoDeudas.style.width = `${porcentajeDeuda}%`;
    }
    if (porcentajeLimiteTexto) {
        porcentajeLimiteTexto.textContent = `${porcentajeDeuda.toFixed(0)}% del límite utilizado`;
    }

    // E. Renderizar Pagos del Mes y Contingente de Pendientes
    const pagosMesHtml = document.getElementById('pagos-mes-html');
    const pagosPendientesContadorHtml = document.getElementById('pagos-pendientes-contador-html');
    
    if (pagosMesHtml) {
        pagosMesHtml.textContent = formatoMoneda(data.pagosMesTotal);
    }
    if (pagosPendientesContadorHtml) {
        pagosPendientesContadorHtml.textContent = `${data.pagosMesPendientesCount} pendiente${data.pagosMesPendientesCount !== 1 ? 's' : ''}`;
    }

    // F. Renderizar Carrusel de "Próximos Pagos" (Suscripciones automatizadas en base al DÍA)
    const proximosContainer = document.getElementById('proximos-pagos-container');
    proximosContainer.innerHTML = ''; // Limpiar maquetación estática

    data.proximosPagos.forEach(pago => {
        // Determinar color de icono según tipo
        const esSuscripcion = pago.categoria_icono === 'live_tv' || pago.tipo === 'suscripcion';
        const bgIcono = esSuscripcion ? 'bg-error-container text-error' : 'bg-secondary-container text-secondary';
        const esPagado = pago.estado === 'pagado';
        const borderStyle = esPagado ? 'border-green-400/30 opacity-75' : 'hover:border-primary/40';

        proximosContainer.innerHTML += `
            <div data-id="${pago.id}" data-entidad="${pago.entidad}" data-monto-restante="${pago.monto_restante}" data-fecha="${pago.fecha}" data-estado="${pago.estado}" data-categoria-icono="${pago.categoria_icono || 'payments'}" data-tipo="${pago.tipo || 'suscripcion'}"
                 class="proximo-pago-item min-w-[280px] glass-panel rounded-2xl p-5 flex items-center gap-4 transition-all cursor-pointer group ${borderStyle}">
                <div class="w-12 h-12 rounded-xl ${bgIcono} flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span class="material-symbols-outlined">${pago.categoria_icono || 'payments'}</span>
                </div>
                <div class="flex-1">
                    <div class="flex justify-between">
                        <p class="font-body-md text-body-md font-bold">${pago.entidad}</p>
                        <p class="font-body-md text-body-md text-on-surface">${formatoMoneda(pago.monto_restante)}</p>
                    </div>
                    <div class="flex justify-between items-center mt-1">
                        <p class="text-on-surface-variant font-label-sm text-label-sm">${pago.fecha}</p>
                        <span class="px-2 py-0.5 rounded-full ${esPagado ? 'bg-green-400/20 text-green-400' : 'bg-surface-container-highest text-on-surface-variant'} text-[10px] font-bold uppercase tracking-tighter">${pago.estado}</span>
                    </div>
                </div>
            </div>
        `;
    });

    // Añadir siempre el botón estático de "Añadir" al final del carrusel
    proximosContainer.innerHTML += `
        <div id="btn-carrusel-add" class="min-w-[120px] rounded-2xl border-2 border-dashed border-outline-variant flex flex-col items-center justify-center gap-2 text-on-surface-variant hover:text-primary hover:border-primary transition-all cursor-pointer">
            <span class="material-symbols-outlined">add</span>
            <span class="font-label-sm text-label-sm">Añadir</span>
        </div>
    `;

    // Asignar evento de apertura al botón del carrusel también
    const btnCarruselAdd = document.getElementById('btn-carrusel-add');
    if (btnCarruselAdd) {
        btnCarruselAdd.addEventListener('click', () => {
            if (modal) {
                document.getElementById('modal-mode').value = 'create';
                if (btnEliminar) btnEliminar.classList.add('hidden');
                if (btnPagarSuscripcion) btnPagarSuscripcion.classList.add('hidden');
                if (btnCancelar) btnCancelar.classList.remove('hidden');
                document.getElementById('modal-titulo').textContent = 'Registrar';
                activarTab('obligacion');
                modal.classList.remove('hidden');
            }
        });
    }

    // G. Renderizar Tabla de "Deudas Pendientes"
    const tablaBody = document.getElementById('tabla-deudas-body');
    tablaBody.innerHTML = '';

    data.deudasTabla.forEach(deuda => {
        // Calcular porcentaje de barra de progreso
        const pagado = parseFloat(deuda.monto_total) - parseFloat(deuda.monto_restante);
        const porcentaje = (pagado / parseFloat(deuda.monto_total)) * 100;

        tablaBody.innerHTML += `
            <tr class="deuda-row hover:bg-surface-container-high transition-colors cursor-pointer group"
                data-id="${deuda.id}" data-entidad="${deuda.entidad}" data-monto-total="${deuda.monto_total}" data-monto-restante="${deuda.monto_restante}" data-fecha="${deuda.fecha}" data-estado="${deuda.estado}">
                <td class="px-6 py-5">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg bg-surface-container-highest flex items-center justify-center">
                            <span class="material-symbols-outlined text-[18px]">account_balance</span>
                        </div>
                        <span class="font-body-md text-body-md font-medium">${deuda.entidad}</span>
                    </div>
                </td>
                <td class="px-6 py-5 font-body-md text-body-md text-on-surface-variant">${formatoMoneda(deuda.monto_total)}</td>
                <td class="px-6 py-5">
                    <div class="flex flex-col gap-1">
                        <span class="font-body-md text-body-md text-on-surface font-semibold">${formatoMoneda(deuda.monto_restante)}</span>
                        <div class="w-24 h-1 bg-outline-variant rounded-full">
                            <div class="bg-primary h-full rounded-full" style="width: ${porcentaje}%"></div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-5 font-body-md text-body-md text-on-surface-variant">${deuda.fecha}</td>
                <td class="px-6 py-5">
                    <span class="flex items-center gap-1.5 text-green-400 font-label-md text-label-md">
                        <span class="w-1.5 h-1.5 rounded-full bg-green-400"></span> Activa
                    </span>
                </td>
            </tr>
        `;
    });

    // H. Renderizar "Actividad Reciente"
    const actividadContainer = document.getElementById('actividad-reciente-container');
    actividadContainer.innerHTML = '';

    data.actividadReciente.forEach(item => {
        const esIngreso = item.tipo_movimiento === 'ingreso';
        const colorTexto = esIngreso ? 'text-green-400' : 'text-on-surface';
        const colorSigno = esIngreso ? '+' : '-';
        const bgIcono = esIngreso ? 'bg-green-400/10 text-green-400' : 'bg-error/10 text-error';
        const icono = esIngreso ? 'south_west' : 'restaurant';

        actividadContainer.innerHTML += `
            <div data-id="${item.id}" data-descripcion="${item.descripcion}" data-monto="${item.monto}" data-tipo-movimiento="${item.tipo_movimiento}" data-fecha="${item.fecha}"
                 class="actividad-item flex items-center justify-between group cursor-pointer hover:bg-surface-container-high/40 p-2 -mx-2 rounded-xl transition-all">
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 rounded-full ${bgIcono} flex items-center justify-center">
                        <span class="material-symbols-outlined text-[20px]">${icono}</span>
                    </div>
                    <div>
                        <p class="font-body-md text-body-md font-bold group-hover:text-primary transition-colors">${item.descripcion}</p>
                        <p class="text-on-surface-variant font-label-sm text-label-sm uppercase tracking-tighter">${item.fecha}</p>
                    </div>
                </div>
                <span class="${colorTexto} font-body-md text-body-md font-bold">${colorSigno}${formatoMoneda(Math.abs(item.monto))}</span>
            </div>
        `;
    });

    // I. Asignar Event Listeners de Edición Interactiva a los Elementos Renderizados
    document.querySelectorAll('.proximo-pago-item').forEach(item => {
        item.addEventListener('click', () => {
            const id = item.getAttribute('data-id');
            const entidad = item.getAttribute('data-entidad');
            const montoRestante = item.getAttribute('data-monto-restante');
            const categoriaIcono = item.getAttribute('data-categoria-icono');
            const tipo = item.getAttribute('data-tipo');
            const fecha = item.getAttribute('data-fecha');

            abrirModoEdicion('obligaciones', id, {
                entidad,
                monto_total: montoRestante,
                tipo: tipo || 'suscripcion',
                categoria_icono: categoriaIcono || 'payments',
                fecha: fecha
            });
        });
    });

    document.querySelectorAll('.deuda-row').forEach(row => {
        row.addEventListener('click', () => {
            const id = row.getAttribute('data-id');
            const entidad = row.getAttribute('data-entidad');
            const montoTotal = row.getAttribute('data-monto-total');
            const fecha = row.getAttribute('data-fecha');

            abrirModoEdicion('obligaciones', id, {
                entidad,
                monto_total: montoTotal,
                tipo: 'deuda',
                categoria_icono: 'account_balance',
                fecha: fecha
            });
        });
    });

    document.querySelectorAll('.actividad-item').forEach(item => {
        item.addEventListener('click', () => {
            const id = item.getAttribute('data-id');
            const descripcionCompleta = item.getAttribute('data-descripcion');
            const monto = item.getAttribute('data-monto');
            const tipoMovimiento = item.getAttribute('data-tipo-movimiento');

            // Separar descripción y categoría
            let descripcion = descripcionCompleta;
            let categoria = '';
            const parts = descripcionCompleta.split(' - ');
            if (parts.length > 1) {
                descripcion = parts[0];
                categoria = parts[1];
            } else if (tipoMovimiento === 'egreso') {
                categoria = descripcionCompleta;
            }

            abrirModoEdicion('transacciones', id, {
                descripcion,
                monto: Math.abs(parseFloat(monto)),
                tipo_movimiento: tipoMovimiento,
                cuenta_id: 1, // Cuenta predeterminada
                categoria: categoria
            });
        });
    });

    // J. Refrescar la sección activa actual de la SPA para reflejar cambios en tiempo real
    if (seccionActiva === 'finanzas') {
        renderFinanzas();
    } else if (seccionActiva === 'deudas') {
        renderDeudas();
    } else if (seccionActiva === 'suscripciones') {
        renderSuscripciones();
    } else if (seccionActiva === 'ingresos') {
        renderHistorialFiltrado('ingreso');
    } else if (seccionActiva === 'egresos') {
        renderHistorialFiltrado('egreso');
    } else if (seccionActiva === 'calendario') {
        renderCalendario(calendarioMesActual, calendarioAnioActual);
    } else if (seccionActiva === 'historial') {
        renderHistorial();
    }
}

// 4. LÓGICA DE CONTROL DEL MODAL Y REGISTRO MULTIPROPÓSITO (FAB)
const modal = document.getElementById('modal-obligacion');
const btnAbrir = document.getElementById('fab-add-button');
const btnCancelar = document.getElementById('btn-cancelar-modal');
const formObligacion = document.getElementById('form-obligacion');
const btnEliminar = document.getElementById('btn-eliminar-modal');
const btnPagarSuscripcion = document.getElementById('btn-pagar-suscripcion');

// Elementos de los Tabs
const tabObligacion = document.getElementById('tab-obligacion');
const tabIngreso = document.getElementById('tab-ingreso');
const tabEgreso = document.getElementById('tab-egreso');
const activeTabInput = document.getElementById('modal-tab-active');

// Elementos de Campos Dinámicos
const wrapperObligacion = document.getElementById('wrapper-campos-obligacion');
const wrapperCuenta = document.getElementById('wrapper-cuenta-select');
const wrapperCategoria = document.getElementById('wrapper-categoria-select');

// Contenedores Condicionales de Fecha/Día de Suscripción
const wrapperFechaVencimiento = document.getElementById('wrapper-fecha-vencimiento');
const wrapperDiaSuscripcion = document.getElementById('wrapper-dia-suscripcion');
const selectDiaSuscripcion = document.getElementById('dia_suscripcion_select');

const wrapperEntidadInput = document.getElementById('wrapper-entidad-input');
const labelEntidad = document.getElementById('label-entidad');
const inputEntidad = document.getElementById('entidad');
const labelMonto = document.getElementById('label-monto');
const inputMonto = document.getElementById('monto_total');

// Inputs de Obligación
const inputFecha = document.getElementById('fecha_vencimiento');
const selectTipo = document.getElementById('tipo');
const selectIcono = document.getElementById('categoria_icono');

// Inputs de Transacción
const selectCuenta = document.getElementById('cuenta_id');
const selectCategoria = document.getElementById('categoria');

// POBLAR DINÁMICAMENTE SELECT DE DÍAS (1 AL 31)
function poblarSelectDias() {
    if (selectDiaSuscripcion && selectDiaSuscripcion.options.length === 0) {
        for (let i = 1; i <= 31; i++) {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = i;
            selectDiaSuscripcion.appendChild(opt);
        }
    }
}

// TOGGLE INTERNO DE SUSCRIPCIÓN VS DEUDA
function conmutarCamposObligacion(tipoObligacion) {
    if (tipoObligacion === 'deuda') {
        if (wrapperFechaVencimiento) wrapperFechaVencimiento.classList.remove('hidden');
        if (wrapperDiaSuscripcion) wrapperDiaSuscripcion.classList.add('hidden');

        if (inputFecha) { inputFecha.disabled = false; inputFecha.required = true; }
        if (selectDiaSuscripcion) { selectDiaSuscripcion.disabled = true; selectDiaSuscripcion.required = false; }
    } else {
        if (wrapperFechaVencimiento) wrapperFechaVencimiento.classList.add('hidden');
        if (wrapperDiaSuscripcion) wrapperDiaSuscripcion.classList.remove('hidden');

        // Poblar dinámicamente si es de tipo suscripción
        poblarSelectDias();

        if (inputFecha) { inputFecha.disabled = true; inputFecha.required = false; }
        if (selectDiaSuscripcion) { selectDiaSuscripcion.disabled = false; selectDiaSuscripcion.required = true; }
    }
}

// Escuchar cambios en el selector de tipo de obligación
if (selectTipo) {
    selectTipo.addEventListener('change', (e) => conmutarCamposObligacion(e.target.value));
}

// MANEJO DE PESTAÑAS (TABS INTERACTIVOS)
function activarTab(tipo) {
    if (!activeTabInput) return;
    activeTabInput.value = tipo;

    // Resetear estilos de todos los tabs a inactivos (on-surface-variant)
    [tabObligacion, tabIngreso, tabEgreso].forEach(tab => {
        if (tab) {
            tab.className = "flex-1 pb-2 text-xs font-bold text-on-surface-variant hover:text-on-surface uppercase tracking-wider text-center transition-all";
        }
    });

    // Activar pestaña visualmente (primary con borde inferior)
    let activeTabBtn;
    if (tipo === 'obligacion') activeTabBtn = tabObligacion;
    if (tipo === 'ingreso') activeTabBtn = tabIngreso;
    if (tipo === 'egreso') activeTabBtn = tabEgreso;

    if (activeTabBtn) {
        activeTabBtn.className = "flex-1 pb-2 text-xs font-bold text-primary border-b-2 border-primary uppercase tracking-wider text-center transition-all";
    }

    // VISIBILIDAD DINÁMICA DE CAMPOS (TOGGLE HIDDEN)
    if (tipo === 'obligacion') {
        if (wrapperObligacion) wrapperObligacion.classList.remove('hidden');
        if (wrapperCuenta) wrapperCuenta.classList.add('hidden');
        if (wrapperCategoria) wrapperCategoria.classList.add('hidden');
        if (wrapperEntidadInput) wrapperEntidadInput.classList.remove('hidden');

        // Validaciones requeridas/deshabilitadas nativas
        if (inputEntidad) { inputEntidad.disabled = false; inputEntidad.required = true; }
        if (selectTipo) { selectTipo.disabled = false; selectTipo.required = true; }
        if (selectIcono) { selectIcono.disabled = false; selectIcono.required = true; }
        if (selectCuenta) { selectCuenta.disabled = true; selectCuenta.required = false; }
        if (selectCategoria) { selectCategoria.disabled = true; selectCategoria.required = false; }

        if (labelEntidad) labelEntidad.textContent = 'Entidad / Nombre';
        if (inputEntidad) inputEntidad.placeholder = 'Ej: Netflix, Tarjeta Visa, Alquiler';
        if (labelMonto) labelMonto.textContent = 'Monto Total';

        // Ejecutar conmutación interna (Fecha vs Día)
        if (selectTipo) conmutarCamposObligacion(selectTipo.value);
    } 
    else if (tipo === 'ingreso') {
        if (wrapperObligacion) wrapperObligacion.classList.add('hidden');
        if (wrapperCuenta) wrapperCuenta.classList.remove('hidden');
        if (wrapperCategoria) wrapperCategoria.classList.add('hidden');
        if (wrapperEntidadInput) wrapperEntidadInput.classList.remove('hidden');

        // Validaciones requeridas/deshabilitadas nativas
        if (inputEntidad) { inputEntidad.disabled = false; inputEntidad.required = true; }
        if (inputFecha) { inputFecha.disabled = true; inputFecha.required = false; }
        if (selectDiaSuscripcion) { selectDiaSuscripcion.disabled = true; selectDiaSuscripcion.required = false; }
        if (selectTipo) { selectTipo.disabled = true; selectTipo.required = false; }
        if (selectIcono) { selectIcono.disabled = true; selectIcono.required = false; }
        if (selectCuenta) { selectCuenta.disabled = false; selectCuenta.required = true; }
        if (selectCategoria) { selectCategoria.disabled = true; selectCategoria.required = false; }

        if (labelEntidad) labelEntidad.textContent = 'Descripción';
        if (inputEntidad) inputEntidad.placeholder = 'Ej: Salario, Venta, Regalo';
        if (labelMonto) labelMonto.textContent = 'Monto';
    } 
    else if (tipo === 'egreso') {
        if (wrapperObligacion) wrapperObligacion.classList.add('hidden');
        if (wrapperCuenta) wrapperCuenta.classList.remove('hidden');
        if (wrapperCategoria) wrapperCategoria.classList.remove('hidden');
        if (wrapperEntidadInput) wrapperEntidadInput.classList.add('hidden');

        // Validaciones requeridas/deshabilitadas nativas
        if (inputEntidad) { inputEntidad.disabled = true; inputEntidad.required = false; }
        if (inputFecha) { inputFecha.disabled = true; inputFecha.required = false; }
        if (selectDiaSuscripcion) { selectDiaSuscripcion.disabled = true; selectDiaSuscripcion.required = false; }
        if (selectTipo) { selectTipo.disabled = true; selectTipo.required = false; }
        if (selectIcono) { selectIcono.disabled = true; selectIcono.required = false; }
        if (selectCuenta) { selectCuenta.disabled = false; selectCuenta.required = true; }
        if (selectCategoria) { selectCategoria.disabled = false; selectCategoria.required = true; }

        if (labelEntidad) labelEntidad.textContent = 'Descripción';
        if (inputEntidad) inputEntidad.placeholder = 'Ej: Comida, Transporte, Alquiler';
        if (labelMonto) labelMonto.textContent = 'Monto';
    }
}

// Oyentes de clics en las pestañas
if (tabObligacion) {
    tabObligacion.addEventListener('click', () => activarTab('obligacion'));
}
if (tabIngreso) {
    tabIngreso.addEventListener('click', () => activarTab('ingreso'));
}
if (tabEgreso) {
    tabEgreso.addEventListener('click', () => activarTab('egreso'));
}

// Abrir modal en Modo Edición
function abrirModoEdicion(itemType, id, data) {
    if (!modal) return;

    document.getElementById('modal-mode').value = 'edit';
    document.getElementById('modal-item-id').value = id;
    document.getElementById('modal-item-type').value = itemType;
    
    const esSuscripcion = itemType === 'obligaciones' && data.tipo === 'suscripcion';
    
    if (btnEliminar) {
        btnEliminar.classList.remove('hidden'); // Mostrar botón eliminar
        btnEliminar.textContent = esSuscripcion ? 'Cancelar Suscripción' : 'Eliminar';
    }
    
    if (btnPagarSuscripcion) {
        if (esSuscripcion) {
            btnPagarSuscripcion.classList.remove('hidden');
        } else {
            btnPagarSuscripcion.classList.add('hidden');
        }
    }

    if (btnCancelar) {
        if (esSuscripcion) {
            btnCancelar.classList.add('hidden'); // Ocultar Cancelar clásico si es suscripción para liberar espacio
        } else {
            btnCancelar.classList.remove('hidden');
        }
    }
    
    document.getElementById('modal-titulo').textContent = 'Editar Registro';

    if (itemType === 'obligaciones') {
        activarTab('obligacion');
        if (inputEntidad) inputEntidad.value = data.entidad;
        if (inputMonto) inputMonto.value = data.monto_total;
        if (selectTipo) {
            selectTipo.value = data.tipo;
            conmutarCamposObligacion(data.tipo);
        }
        if (selectIcono) selectIcono.value = data.categoria_icono;

        if (data.tipo === 'suscripcion') {
            const parts = data.fecha ? data.fecha.split(' ') : [];
            if (parts.length > 0) {
                const dia = parseInt(parts[0]);
                if (selectDiaSuscripcion && !isNaN(dia)) selectDiaSuscripcion.value = dia;
            }
        } else {
            if (inputFecha) inputFecha.value = ''; // Se limpia para que elija fecha
        }
    } else {
        // transacciones
        activarTab(data.tipo_movimiento);
        if (inputEntidad) inputEntidad.value = data.descripcion;
        if (inputMonto) inputMonto.value = data.monto;
        if (selectCuenta) selectCuenta.value = data.cuenta_id || '1';
        if (data.tipo_movimiento === 'egreso' && selectCategoria) {
            selectCategoria.value = data.categoria || 'Otros';
        }
    }

    modal.classList.remove('hidden');
}

// Abrir modal en Modo Creación (FAB)
if (btnAbrir && modal) {
    btnAbrir.addEventListener('click', () => {
        document.getElementById('modal-mode').value = 'create';
        document.getElementById('modal-item-id').value = '';
        document.getElementById('modal-item-type').value = '';
        if (btnEliminar) {
            btnEliminar.classList.add('hidden');
            btnEliminar.textContent = 'Eliminar';
        }
        if (btnPagarSuscripcion) {
            btnPagarSuscripcion.classList.add('hidden');
        }
        if (btnCancelar) {
            btnCancelar.classList.remove('hidden');
        }
        document.getElementById('modal-titulo').textContent = 'Registrar';
        activarTab('obligacion');
        modal.classList.remove('hidden');
    });
}

// Cerrar modal
const cerrarModal = () => {
    if (modal) {
        modal.classList.add('hidden');
        if (formObligacion) formObligacion.reset();
    }
};

if (btnCancelar) {
    btnCancelar.addEventListener('click', cerrarModal);
}

// Cerrar al hacer clic fuera del panel del modal
if (modal) {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            cerrarModal();
        }
    });
}

// Lógica de eliminación (Delete o Cancelar Suscripción)
if (btnEliminar) {
    btnEliminar.addEventListener('click', async () => {
        const id = document.getElementById('modal-item-id').value;
        const tipo = document.getElementById('modal-item-type').value;

        if (!id || !tipo) return;

        const esSuscripcionVal = tipo === 'obligaciones' && selectTipo.value === 'suscripcion';
        const confirmMsg = esSuscripcionVal 
            ? '¿Estás seguro de que deseas cancelar esta suscripción de forma permanente?'
            : '¿Estás seguro de que deseas eliminar este registro?';

        if (confirm(confirmMsg)) {
            const response = await eliminarRegistro(id, tipo);
            if (response) {
                cerrarModal();
                await cargarDashboard();
            } else {
                alert('Hubo un error al eliminar el registro. Revisa el estado de la base de datos.');
            }
        }
    });
}

// LÓGICA DE ACCIÓN: MARCAR COMO PAGADA (REGISTRAR EGRESO ASOCIADO)
if (btnPagarSuscripcion) {
    btnPagarSuscripcion.addEventListener('click', async () => {
        const id = document.getElementById('modal-item-id').value;
        const entidad = inputEntidad.value;
        const monto = parseFloat(inputMonto.value);

        if (!id || !entidad || isNaN(monto)) return;

        if (confirm(`¿Deseas registrar el pago de la suscripción "${entidad}" por un valor de ${formatoMoneda(monto)}?`)) {
            const data = {
                descripcion: `Pago mensual - ${entidad}`,
                monto: monto,
                tipo_movimiento: 'egreso',
                cuenta_id: 1, // Efectivo por defecto
                categoria: 'Otros',
                obligacion_id: parseInt(id)
            };

            const response = await crearTransaccion(data);
            if (response) {
                cerrarModal();
                await cargarDashboard();
            } else {
                alert('Hubo un error al registrar el pago mensual de la suscripción.');
            }
        }
    });
}

// Procesar formulario (Submit - Creación o Edición)
if (formObligacion) {
    formObligacion.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const activeTab = activeTabInput.value;
        const mode = document.getElementById('modal-mode').value;
        const id = document.getElementById('modal-item-id').value;
        const itemType = document.getElementById('modal-item-type').value;
        
        const formData = new FormData(formObligacion);
        let response;

        if (mode === 'create') {
            if (activeTab === 'obligacion') {
                const tipoObligacion = formData.get('tipo');
                let fecha_vencimiento = formData.get('fecha_vencimiento');

                // Si es Suscripción, construimos una fecha YYYY-MM-DD usando mes y año actuales
                if (tipoObligacion === 'suscripcion') {
                    const diaVal = parseInt(formData.get('dia_suscripcion_select'));
                    const today = new Date();
                    const year = today.getFullYear();
                    const month = String(today.getMonth() + 1).padStart(2, '0');
                    const dayStr = String(diaVal).padStart(2, '0');
                    fecha_vencimiento = `${year}-${month}-${dayStr}`;
                }

                const data = {
                    entidad: formData.get('entidad'),
                    monto_total: parseFloat(formData.get('monto_total')),
                    fecha_vencimiento: fecha_vencimiento,
                    tipo: tipoObligacion,
                    categoria_icono: formData.get('categoria_icono')
                };
                response = await crearObligacion(data);
            } else {
                const data = {
                    descripcion: activeTab === 'egreso' ? selectCategoria.value : formData.get('entidad'),
                    monto: parseFloat(formData.get('monto_total')),
                    cuenta_id: parseInt(formData.get('cuenta_id')),
                    categoria: activeTab === 'egreso' ? formData.get('categoria') : null,
                    tipo_movimiento: activeTab
                };
                response = await crearTransaccion(data);
            }
        } else {
            // MODO EDICIÓN (PUT)
            if (itemType === 'obligaciones') {
                const tipoObligacion = formData.get('tipo');
                let fecha_vencimiento = formData.get('fecha_vencimiento');

                if (tipoObligacion === 'suscripcion') {
                    const diaVal = parseInt(formData.get('dia_suscripcion_select'));
                    const today = new Date();
                    const year = today.getFullYear();
                    const month = String(today.getMonth() + 1).padStart(2, '0');
                    const dayStr = String(diaVal).padStart(2, '0');
                    fecha_vencimiento = `${year}-${month}-${dayStr}`;
                } else if (!fecha_vencimiento) {
                    fecha_vencimiento = new Date().toISOString().split('T')[0]; // Fallback
                }

                const data = {
                    entidad: formData.get('entidad'),
                    monto_total: parseFloat(formData.get('monto_total')),
                    fecha_vencimiento: fecha_vencimiento,
                    tipo: tipoObligacion,
                    categoria_icono: formData.get('categoria_icono')
                };
                response = await actualizarRegistro(id, 'obligaciones', data);
            } else {
                const data = {
                    descripcion: activeTab === 'egreso' ? selectCategoria.value : formData.get('entidad'),
                    monto: parseFloat(formData.get('monto_total')),
                    cuenta_id: parseInt(formData.get('cuenta_id')),
                    categoria: activeTab === 'egreso' ? formData.get('categoria') : null,
                    tipo_movimiento: activeTab
                };
                response = await actualizarRegistro(id, 'transacciones', data);
            }
        }

        if (response) {
            cerrarModal();
            await cargarDashboard();
        } else {
            alert('Hubo un error al registrar la información. Revisa la consola o el estado de tu base de datos.');
        }
    });
}

// ==========================================
// NUEVA FUNCIONALIDAD: CALENDARIO MENSUAL DE VENCIMIENTOS
// ==========================================

const dashboardPrincipal = document.getElementById('dashboard-principal');
const calendarioSeccion = document.getElementById('calendario-seccion');
const btnVerCalendario = document.getElementById('btn-ver-calendario');
const btnHeaderCalendario = document.getElementById('btn-header-calendario');
const btnCerrarCalendario = document.getElementById('btn-cerrar-calendario');
const btnCalendarioPrev = document.getElementById('btn-calendario-prev');
const btnCalendarioNext = document.getElementById('btn-calendario-next');
const calendarioMesTitulo = document.getElementById('calendario-mes-titulo');
const calendarioGrid = document.getElementById('calendario-grid');

function renderCalendario(mes, anio) {
    if (!calendarioGrid || !calendarioMesTitulo) return;

    // Nombres de meses en español
    const mesesNombres = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    // Actualizar cabecera del mes y año en curso
    calendarioMesTitulo.textContent = `${mesesNombres[mes]} ${anio}`;

    // Limpiar cuadrícula
    calendarioGrid.innerHTML = '';

    // Primer día del mes y su mapeo al grid (Lunes = 0, Domingo = 6)
    const primerDiaSemanaRaw = new Date(anio, mes, 1).getDay();
    const diaInicio = primerDiaSemanaRaw === 0 ? 6 : primerDiaSemanaRaw - 1;

    // Total de días del mes actual y del anterior
    const totalDiasMes = new Date(anio, mes + 1, 0).getDate();
    const totalDiasMesAnterior = new Date(anio, mes, 0).getDate();

    // 1. Pintar días inactivos del mes anterior (atenuados)
    for (let i = diaInicio - 1; i >= 0; i--) {
        const diaNum = totalDiasMesAnterior - i;
        calendarioGrid.innerHTML += `
            <div class="h-32 bg-surface-container/10 border border-outline-variant/10 rounded-2xl p-2 opacity-25 pointer-events-none select-none flex flex-col justify-start">
                <span class="font-label-md text-label-md text-on-surface-variant font-medium text-xs">${diaNum}</span>
            </div>
        `;
    }

    // Fecha actual para destacar "hoy"
    const hoy = new Date();
    const esMesActual = hoy.getMonth() === mes && hoy.getFullYear() === anio;
    const diaHoy = hoy.getDate();

    // 2. Pintar días del mes actual
    for (let dia = 1; dia <= totalDiasMes; dia++) {
        const esHoy = esMesActual && dia === diaHoy;
        const claseHoy = esHoy 
            ? 'bg-primary text-background rounded-full w-6 h-6 flex items-center justify-center font-bold text-xs shadow-md' 
            : 'font-label-md text-label-md text-on-surface-variant font-bold text-xs';

        // Filtrar Deudas vencidas este día (Año y Mes exactos)
        const fechaCeldaStr = `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        const deudasDelDia = todasObligaciones.filter(o => o.tipo === 'deuda' && o.fecha_vencimiento === fechaCeldaStr);

        // Filtrar Suscripciones recurrentes (coincide el día del mes)
        const suscripcionesDelDia = todasObligaciones.filter(o => {
            if (o.tipo !== 'suscripcion') return false;
            // Extraer el día de la fecha de vencimiento (formato YYYY-MM-DD)
            const parts = o.fecha_vencimiento ? o.fecha_vencimiento.split('-') : [];
            const diaCobro = parts.length > 2 ? parseInt(parts[2]) : null;
            return diaCobro === dia;
        });

        // Crear el casillero
        let celdasEventosHTML = '';

        // Agregar Deudas al casillero
        deudasDelDia.forEach(deuda => {
            const esPagada = deuda.estado === 'pagado';
            const bgBadge = esPagada 
                ? 'bg-green-400/10 text-green-400 border border-green-400/20 opacity-70 line-through' 
                : 'bg-error-container/30 text-error border border-error/20';

            celdasEventosHTML += `
                <div data-id="${deuda.id}" data-entidad="${deuda.entidad}" data-monto="${deuda.monto_total}" data-tipo="deuda" data-fecha="${deuda.fecha_vencimiento}" data-categoria-icono="${deuda.categoria_icono || 'account_balance'}"
                     class="calendario-badge flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[9px] font-bold tracking-tight transition-transform hover:scale-102 cursor-pointer ${bgBadge}">
                    <span class="material-symbols-outlined text-[11px]">${deuda.categoria_icono || 'account_balance'}</span>
                    <span class="truncate max-w-[55px]">${deuda.entidad}</span>
                    <span class="ml-auto font-mono text-[8px]">${formatoMoneda(deuda.monto_restante).replace(/\s/g, '').replace(',00', '')}</span>
                </div>
            `;
        });

        // Agregar Suscripciones recurrentes al casillero
        suscripcionesDelDia.forEach(susc => {
            const esPagada = susc.estado === 'pagado';
            const bgBadge = esPagada 
                ? 'bg-green-400/10 text-green-400 border border-green-400/20 opacity-70 line-through' 
                : 'bg-secondary-container/30 text-on-secondary-container border border-secondary-container/20';

            celdasEventosHTML += `
                <div data-id="${susc.id}" data-entidad="${susc.entidad}" data-monto="${susc.monto_total}" data-tipo="suscripcion" data-fecha="${susc.fecha_vencimiento}" data-categoria-icono="${susc.categoria_icono || 'subscriptions'}"
                     class="calendario-badge flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[9px] font-bold tracking-tight transition-transform hover:scale-102 cursor-pointer ${bgBadge}">
                    <span class="material-symbols-outlined text-[11px]">${susc.categoria_icono || 'subscriptions'}</span>
                    <span class="truncate max-w-[55px]">${susc.entidad}</span>
                    <span class="ml-auto font-mono text-[8px]">${formatoMoneda(susc.monto_restante).replace(/\s/g, '').replace(',00', '')}</span>
                </div>
            `;
        });

        calendarioGrid.innerHTML += `
            <div class="h-32 bg-surface-container/20 border border-outline-variant/30 rounded-2xl p-2 flex flex-col gap-1.5 overflow-hidden transition-all hover:bg-surface-container-high/30">
                <div class="flex justify-between items-center mb-0.5">
                    <span class="${claseHoy}">${dia}</span>
                    ${esHoy ? '<span class="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>' : ''}
                </div>
                <div class="flex-1 flex flex-col gap-1 overflow-y-auto scroll-hide">
                    ${celdasEventosHTML}
                </div>
            </div>
        `;
    }

    // 3. Pintar días inactivos del mes siguiente para completar la cuadrícula (atenuados)
    const totalCeldasActuales = diaInicio + totalDiasMes;
    const totalCeldasGrid = Math.ceil(totalCeldasActuales / 7) * 7;
    const celdasFaltantes = totalCeldasGrid - totalCeldasActuales;

    for (let i = 1; i <= celdasFaltantes; i++) {
        calendarioGrid.innerHTML += `
            <div class="h-32 bg-surface-container/10 border border-outline-variant/10 rounded-2xl p-2 opacity-25 pointer-events-none select-none flex flex-col justify-start">
                <span class="font-label-md text-label-md text-on-surface-variant font-medium text-xs">${i}</span>
            </div>
        `;
    }
}

// OYENTES DE EVENTOS PARA EL CALENDARIO
// Función para abrir la vista de calendario
function abrirCalendario() {
    calendarioMesActual = new Date().getMonth();
    calendarioAnioActual = new Date().getFullYear();
    navegarA('calendario');
}

if (btnVerCalendario) {
    btnVerCalendario.addEventListener('click', abrirCalendario);
}

if (btnHeaderCalendario) {
    btnHeaderCalendario.addEventListener('click', abrirCalendario);
}

if (btnCerrarCalendario) {
    btnCerrarCalendario.addEventListener('click', () => {
        navegarA('inicio');
    });
}

if (btnCalendarioPrev) {
    btnCalendarioPrev.addEventListener('click', () => {
        calendarioMesActual--;
        if (calendarioMesActual < 0) {
            calendarioMesActual = 11;
            calendarioAnioActual--;
        }
        renderCalendario(calendarioMesActual, calendarioAnioActual);
    });
}

if (btnCalendarioNext) {
    btnCalendarioNext.addEventListener('click', () => {
        calendarioMesActual++;
        if (calendarioMesActual > 11) {
            calendarioMesActual = 0;
            calendarioAnioActual++;
        }
        renderCalendario(calendarioMesActual, calendarioAnioActual);
    });
}

// Delegación de clics en badges del calendario para edición instantánea
if (calendarioGrid) {
    calendarioGrid.addEventListener('click', (e) => {
        const badge = e.target.closest('.calendario-badge');
        if (badge) {
            const id = badge.getAttribute('data-id');
            const entidad = badge.getAttribute('data-entidad');
            const monto = badge.getAttribute('data-monto');
            const tipo = badge.getAttribute('data-tipo');
            const fecha = badge.getAttribute('data-fecha');
            const categoriaIcono = badge.getAttribute('data-categoria-icono');

            abrirModoEdicion('obligaciones', id, {
                entidad,
                monto_total: monto,
                tipo,
                categoria_icono: categoriaIcono,
                fecha
            });
        }
    });
}

// ==========================================
// NUEVA FUNCIONALIDAD: HISTORIAL COMPLETO DE TRANSACCIONES
// ==========================================

const historialSeccion = document.getElementById('historial-seccion');
const btnVerHistorial = document.getElementById('btn-ver-historial');
const btnCerrarHistorial = document.getElementById('btn-cerrar-historial');
const tablaHistorialBody = document.getElementById('tabla-historial-body');

function renderHistorial() {
    if (!tablaHistorialBody) return;

    tablaHistorialBody.innerHTML = ''; // Limpiar maquetación previa

    transaccionesHistorial.forEach(item => {
        const esIngreso = item.tipo_movimiento === 'ingreso';
        const colorTexto = esIngreso ? 'text-green-400 font-bold' : 'text-on-surface';
        const colorSigno = esIngreso ? '+' : '-';
        const bgIcono = esIngreso ? 'bg-green-400/10 text-green-400' : 'bg-error/10 text-error';
        const icono = esIngreso ? 'south_west' : 'restaurant';
        const colorBadgeTipo = esIngreso ? 'bg-green-400/10 text-green-400 border border-green-400/20' : 'bg-error/10 text-error border border-error/20';

        // Separar descripción y categoría
        let descripcion = item.descripcion;
        let categoria = '';
        const parts = item.descripcion.split(' - ');
        if (parts.length > 1) {
            descripcion = parts[0];
            categoria = parts[1];
        }

        // Crear fila dinámica en la tabla
        tablaHistorialBody.innerHTML += `
            <tr class="historial-row hover:bg-surface-container-high transition-colors cursor-pointer group"
                data-id="${item.id}" data-descripcion="${item.descripcion}" data-monto="${item.monto}" data-tipo-movimiento="${item.tipo_movimiento}">
                <td class="px-6 py-4 font-body-md text-body-md text-on-surface-variant font-mono text-xs uppercase tracking-tighter">${item.fecha}</td>
                <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full ${bgIcono} flex items-center justify-center flex-shrink-0">
                            <span class="material-symbols-outlined text-[16px]">${icono}</span>
                        </div>
                        <div class="flex flex-col">
                            <span class="font-body-md text-body-md font-bold group-hover:text-primary transition-colors">${descripcion}</span>
                            ${categoria ? `<span class="px-1.5 py-0.5 mt-0.5 w-max rounded text-[9px] font-bold tracking-widest bg-outline-variant/30 text-on-surface-variant uppercase">${categoria}</span>` : ''}
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4">
                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${colorBadgeTipo}">${item.tipo_movimiento}</span>
                </td>
                <td class="px-6 py-4 ${colorTexto} font-body-md text-body-md">${colorSigno}${formatoMoneda(Math.abs(item.monto))}</td>
            </tr>
        `;
    });
}

// Oyentes para cambiar vistas de Historial
if (btnVerHistorial) {
    btnVerHistorial.addEventListener('click', () => {
        navegarA('historial');
    });
}

if (btnCerrarHistorial) {
    btnCerrarHistorial.addEventListener('click', () => {
        navegarA('inicio');
    });
}

// Delegar clic sobre la tabla del historial para edición de transacciones
if (tablaHistorialBody) {
    tablaHistorialBody.addEventListener('click', (e) => {
        const row = e.target.closest('.historial-row');
        if (row) {
            const id = row.getAttribute('data-id');
            const descripcionCompleta = row.getAttribute('data-descripcion');
            const monto = row.getAttribute('data-monto');
            const tipoMovimiento = row.getAttribute('data-tipo-movimiento');

            let descripcion = descripcionCompleta;
            let categoria = '';
            const parts = descripcionCompleta.split(' - ');
            if (parts.length > 1) {
                descripcion = parts[0];
                categoria = parts[1];
            } else if (tipoMovimiento === 'egreso') {
                categoria = descripcionCompleta;
            }

            abrirModoEdicion('transacciones', id, {
                descripcion,
                monto: Math.abs(parseFloat(monto)),
                tipo_movimiento: tipoMovimiento,
                cuenta_id: 1, // Cuenta por defecto
                categoria: categoria
            });
        }
    });
}

// ==========================================
// RENDERIZADO Y CONTROLADORES DE MÓDULOS DE LA SPA (NUEVO)
// ==========================================

function navegarA(seccion) {
    seccionActiva = seccion;

    // 1. Ocultar todas las secciones principales
    const secciones = [
        'dashboard-principal',
        'calendario-seccion',
        'historial-seccion',
        'finanzas-seccion',
        'deudas-seccion',
        'suscripciones-seccion',
        'configuracion-seccion'
    ];
    secciones.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });

    // 2. Restablecer estilos visuales del menú lateral (remover activo, poner inactivo)
    const menuIds = {
        inicio: 'menu-inicio',
        finanzas: 'menu-finanzas',
        deudas: 'menu-deudas',
        suscripciones: 'menu-suscripciones',
        ingresos: 'menu-ingresos',
        egresos: 'menu-egresos',
        configuracion: 'menu-configuracion'
    };

    // Estilos activos e inactivos de Tailwind
    const clasesActivas = ['bg-secondary-container', 'text-on-secondary-container', 'font-bold', 'scale-98', 'active:scale-95'];
    const clasesInactivas = ['text-on-surface-variant', 'hover:bg-surface-container-high'];

    Object.entries(menuIds).forEach(([key, id]) => {
        const link = document.getElementById(id);
        if (link) {
            const icon = link.querySelector('.material-symbols-outlined');
            if (key === seccion) {
                // Aplicar estilo activo
                clasesInactivas.forEach(c => link.classList.remove(c));
                clasesActivas.forEach(c => link.classList.add(c));
                if (icon) icon.style.fontVariationSettings = "'FILL' 1";
            } else {
                // Aplicar estilo inactivo
                clasesActivas.forEach(c => link.classList.remove(c));
                clasesInactivas.forEach(c => link.classList.add(c));
                if (icon) icon.style.fontVariationSettings = "";
            }
        }
    });

    // 3. Mostrar y renderizar la sección seleccionada
    if (seccion === 'inicio') {
        const el = document.getElementById('dashboard-principal');
        if (el) el.classList.remove('hidden');
    } else if (seccion === 'finanzas') {
        const el = document.getElementById('finanzas-seccion');
        if (el) el.classList.remove('hidden');
        renderFinanzas();
    } else if (seccion === 'deudas') {
        const el = document.getElementById('deudas-seccion');
        if (el) el.classList.remove('hidden');
        renderDeudas();
    } else if (seccion === 'suscripciones') {
        const el = document.getElementById('suscripciones-seccion');
        if (el) el.classList.remove('hidden');
        renderSuscripciones();
    } else if (seccion === 'ingresos') {
        const el = document.getElementById('historial-seccion');
        if (el) el.classList.remove('hidden');
        renderHistorialFiltrado('ingreso');
    } else if (seccion === 'egresos') {
        const el = document.getElementById('historial-seccion');
        if (el) el.classList.remove('hidden');
        renderHistorialFiltrado('egreso');
    } else if (seccion === 'configuracion') {
        const el = document.getElementById('configuracion-seccion');
        if (el) el.classList.remove('hidden');
    } else if (seccion === 'calendario') {
        const el = document.getElementById('calendario-seccion');
        if (el) el.classList.remove('hidden');
        renderCalendario(calendarioMesActual, calendarioAnioActual);
    } else if (seccion === 'historial') {
        const el = document.getElementById('historial-seccion');
        if (el) el.classList.remove('hidden');
        renderHistorial();
    }
}

function renderFinanzas() {
    const grid = document.getElementById('cuentas-desglosadas-grid');
    if (!grid) return;
    grid.innerHTML = '';

    todasCuentas.forEach(cuenta => {
        let colorBg = 'bg-gradient-to-br from-primary/10 via-surface-container to-background border-outline-variant hover:border-primary/40';
        let colorTexto = 'text-primary';
        let icono = 'credit_card';

        if (cuenta.id === 1 || cuenta.nombre.toLowerCase().includes('efectivo')) {
            colorBg = 'bg-gradient-to-br from-emerald-950/30 via-surface-container/60 to-emerald-900/10 border-emerald-500/20 hover:border-emerald-500/40';
            colorTexto = 'text-emerald-400';
            icono = 'payments';
        } else if (cuenta.id === 2 || cuenta.nombre.toLowerCase().includes('nequi')) {
            colorBg = 'bg-gradient-to-br from-purple-950/30 via-surface-container/60 to-purple-900/10 border-purple-500/20 hover:border-purple-500/40';
            colorTexto = 'text-purple-400';
            icono = 'wallet';
        } else if (cuenta.id === 3 || cuenta.nombre.toLowerCase().includes('bancolombia')) {
            colorBg = 'bg-gradient-to-br from-amber-950/30 via-surface-container/60 to-amber-900/10 border-amber-500/20 hover:border-amber-500/40';
            colorTexto = 'text-amber-400';
            icono = 'account_balance';
        }

        // Filtrar transacciones recientes de la cuenta
        const txs = transaccionesHistorial.filter(t => t.cuenta_id === cuenta.id).slice(0, 3);
        let txsHTML = '';
        if (txs.length === 0) {
            txsHTML = `<p class="text-xs text-on-surface-variant italic mt-2">Sin movimientos recientes</p>`;
        } else {
            txs.forEach(t => {
                const esIngreso = t.tipo_movimiento === 'ingreso';
                const colorVal = esIngreso ? 'text-green-400 font-medium' : 'text-on-surface';
                const signo = esIngreso ? '+' : '-';
                
                // Separar descripción y categoría
                let desc = t.descripcion;
                const parts = t.descripcion.split(' - ');
                if (parts.length > 1) desc = parts[0];

                txsHTML += `
                    <div class="flex justify-between items-center text-xs py-1.5 border-b border-outline-variant/20 last:border-0">
                        <span class="text-on-surface font-medium truncate max-w-[120px]">${desc}</span>
                        <span class="${colorVal}">${signo}${formatoMoneda(Math.abs(t.monto)).replace(/\s/g, '').replace(',00', '')}</span>
                    </div>
                `;
            });
        }

        grid.innerHTML += `
            <div class="glass-panel rounded-3xl p-6 border flex flex-col justify-between min-h-[240px] transition-all hover:scale-102 ${colorBg}">
                <div>
                    <div class="flex justify-between items-center mb-4">
                        <h4 class="font-headline-md text-headline-md text-on-surface font-bold">${cuenta.nombre}</h4>
                        <span class="material-symbols-outlined ${colorTexto}">${icono}</span>
                    </div>
                    <p class="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Saldo Disponible</p>
                    <h3 class="font-headline-lg text-headline-lg mt-1 font-bold ${colorTexto}">${formatoMoneda(cuenta.balance_actual)}</h3>
                </div>
                <div class="mt-6 border-t border-outline-variant/30 pt-4">
                    <p class="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider mb-2">Últimos Movimientos</p>
                    <div class="flex flex-col gap-1">
                        ${txsHTML}
                    </div>
                </div>
            </div>
        `;
    });
}

function renderDeudas() {
    const grid = document.getElementById('deudas-desglosadas-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const deudas = todasObligaciones.filter(o => o.tipo === 'deuda');
    if (deudas.length === 0) {
        grid.innerHTML = `
            <div class="col-span-2 text-center py-12 glass-panel rounded-3xl border border-outline-variant/30">
                <span class="material-symbols-outlined text-[48px] text-on-surface-variant/40">credit_card_off</span>
                <p class="text-on-surface-variant mt-2 font-medium">No tienes deudas pendientes registradas.</p>
            </div>
        `;
        return;
    }

    deudas.forEach(deuda => {
        const pagado = parseFloat(deuda.monto_total) - parseFloat(deuda.monto_restante);
        const porcentaje = parseFloat(deuda.monto_total) > 0 ? (pagado / parseFloat(deuda.monto_total)) * 100 : 0;
        const esPagada = deuda.estado === 'pagado';
        
        const bgCard = esPagada 
            ? 'bg-gradient-to-br from-green-950/20 via-surface-container/60 to-background border-green-500/10 opacity-75' 
            : 'bg-gradient-to-br from-error-container/5 via-surface-container to-background border-outline-variant hover:border-error/30';
        const colorTexto = esPagada ? 'text-green-400' : 'text-error';
        const badgeEstado = esPagada
            ? '<span class="px-2 py-0.5 rounded-full bg-green-400/20 text-green-400 text-[10px] font-bold uppercase tracking-wider">Pagada</span>'
            : '<span class="px-2 py-0.5 rounded-full bg-error/15 text-error text-[10px] font-bold uppercase tracking-wider">Activa</span>';

        grid.innerHTML += `
            <div data-id="${deuda.id}" data-entidad="${deuda.entidad}" data-monto-total="${deuda.monto_total}" data-monto-restante="${deuda.monto_restante}" data-fecha="${deuda.fecha_vencimiento}" data-estado="${deuda.estado}"
                 class="deuda-card glass-panel rounded-3xl p-6 border flex flex-col justify-between transition-all hover:scale-102 hover:shadow-lg cursor-pointer group ${bgCard}">
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <span class="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Obligación Financiera</span>
                        <h4 class="font-headline-md text-headline-md font-bold text-on-surface mt-1 group-hover:text-primary transition-colors">${deuda.entidad}</h4>
                    </div>
                    ${badgeEstado}
                </div>
                
                <div class="grid grid-cols-2 gap-4 my-4">
                    <div>
                        <p class="text-[11px] text-on-surface-variant font-medium">Deuda Total</p>
                        <p class="font-body-md text-body-md font-bold text-on-surface mt-0.5">${formatoMoneda(deuda.monto_total)}</p>
                    </div>
                    <div>
                        <p class="text-[11px] text-on-surface-variant font-medium">Restante por Pagar</p>
                        <p class="font-body-md text-body-md font-bold text-on-surface mt-0.5 ${colorTexto}">${formatoMoneda(deuda.monto_restante)}</p>
                    </div>
                </div>

                <div class="mt-2">
                    <div class="flex justify-between text-[11px] text-on-surface-variant mb-1 font-semibold">
                        <span>Progreso de Abonos</span>
                        <span>${porcentaje.toFixed(0)}%</span>
                    </div>
                    <div class="w-full bg-outline-variant/30 h-2 rounded-full overflow-hidden">
                        <div class="h-full rounded-full transition-all ${esPagada ? 'bg-green-400' : 'bg-primary'}" style="width: ${porcentaje}%"></div>
                    </div>
                </div>

                <div class="flex justify-between items-center mt-6 pt-4 border-t border-outline-variant/20 text-xs text-on-surface-variant font-medium">
                    <span class="flex items-center gap-1">
                        <span class="material-symbols-outlined text-[16px]">calendar_today</span>
                        Vence: ${deuda.fecha_vencimiento}
                    </span>
                    <span class="text-primary group-hover:translate-x-1 transition-transform flex items-center gap-0.5">
                        Editar <span class="material-symbols-outlined text-[14px]">chevron_right</span>
                    </span>
                </div>
            </div>
        `;
    });

    // Asignar event listeners a las tarjetas de deuda recién creadas
    grid.querySelectorAll('.deuda-card').forEach(card => {
        card.addEventListener('click', () => {
            const id = card.getAttribute('data-id');
            const entidad = card.getAttribute('data-entidad');
            const montoTotal = card.getAttribute('data-monto-total');
            const fecha = card.getAttribute('data-fecha');
            const estado = card.getAttribute('data-estado');

            abrirModoEdicion('obligaciones', id, {
                entidad,
                monto_total: montoTotal,
                tipo: 'deuda',
                categoria_icono: 'account_balance',
                fecha: fecha,
                estado: estado
            });
        });
    });
}

function renderSuscripciones() {
    const grid = document.getElementById('suscripciones-desglosadas-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const suscripciones = todasObligaciones.filter(o => o.tipo === 'suscripcion');
    if (suscripciones.length === 0) {
        grid.innerHTML = `
            <div class="col-span-3 text-center py-12 glass-panel rounded-3xl border border-outline-variant/30 w-full">
                <span class="material-symbols-outlined text-[48px] text-on-surface-variant/40">unsubscribe</span>
                <p class="text-on-surface-variant mt-2 font-medium">No tienes suscripciones registradas.</p>
            </div>
        `;
        return;
    }

    suscripciones.forEach(susc => {
        // Extraer día de pago del formato YYYY-MM-DD
        const parts = susc.fecha_vencimiento ? susc.fecha_vencimiento.split('-') : [];
        const diaPago = parts.length > 2 ? parseInt(parts[2]) : 'Men-';

        // Determinar estado de pago de este mes buscando transacciones coincidentes
        const pagadoEsteMes = transaccionesHistorial.some(t => 
            (t.descripcion.toLowerCase().includes(susc.entidad.toLowerCase())) &&
            t.tipo_movimiento === 'egreso' &&
            t.fecha.includes(new Date().getFullYear()) &&
            (t.fecha.includes('May') || t.fecha.includes('Jun') || t.fecha.includes('Jul')) // Soporta formatos localizados
        );

        const esPagada = susc.estado === 'pagado' || pagadoEsteMes;
        const bgIcon = esPagada ? 'bg-green-400/10 text-green-400' : 'bg-primary/10 text-primary';
        const bgCard = esPagada
            ? 'bg-gradient-to-br from-green-950/10 via-surface-container/60 to-background border-green-500/10 opacity-80'
            : 'bg-gradient-to-br from-primary/5 via-surface-container to-background border-outline-variant hover:border-primary/30';
        const badgeEstado = esPagada
            ? '<span class="px-2.5 py-0.5 rounded-full bg-green-400/20 text-green-400 text-[10px] font-bold uppercase tracking-wider">Pagada</span>'
            : '<span class="px-2.5 py-0.5 rounded-full bg-error/15 text-error text-[10px] font-bold uppercase tracking-wider">Pendiente</span>';

        grid.innerHTML += `
            <div data-id="${susc.id}" data-entidad="${susc.entidad}" data-monto-total="${susc.monto_total}" data-fecha="${susc.fecha_vencimiento}" data-estado="${susc.estado}" data-categoria-icono="${susc.categoria_icono || 'subscriptions'}"
                 class="suscripcion-card glass-panel rounded-3xl p-6 border flex flex-col justify-between min-h-[220px] transition-all hover:scale-102 hover:shadow-lg cursor-pointer group ${bgCard}">
                <div class="flex justify-between items-start mb-4">
                    <div class="w-12 h-12 rounded-2xl ${bgIcon} flex items-center justify-center group-hover:scale-110 transition-transform">
                        <span class="material-symbols-outlined text-[24px]">${susc.categoria_icono || 'subscriptions'}</span>
                    </div>
                    ${badgeEstado}
                </div>
                
                <div>
                    <span class="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Pago Recurrente</span>
                    <h4 class="font-headline-md text-headline-md font-bold text-on-surface mt-0.5 group-hover:text-primary transition-colors">${susc.entidad}</h4>
                    <h3 class="font-headline-lg text-headline-lg font-bold text-primary mt-2">${formatoMoneda(susc.monto_total)} <span class="text-xs text-on-surface-variant font-normal">/ mes</span></h3>
                </div>

                <div class="flex justify-between items-center mt-6 pt-4 border-t border-outline-variant/20 text-xs text-on-surface-variant font-medium">
                    <span class="flex items-center gap-1.5 font-semibold text-on-surface-variant">
                        <span class="material-symbols-outlined text-[16px] text-primary">calendar_today</span>
                        Corte: Día ${diaPago} de cada mes
                    </span>
                    <span class="text-primary group-hover:translate-x-1 transition-transform flex items-center gap-0.5">
                        Editar <span class="material-symbols-outlined text-[14px]">chevron_right</span>
                    </span>
                </div>
            </div>
        `;
    });

    // Asignar event listeners a las tarjetas de suscripción recién creadas
    grid.querySelectorAll('.suscripcion-card').forEach(card => {
        card.addEventListener('click', () => {
            const id = card.getAttribute('data-id');
            const entidad = card.getAttribute('data-entidad');
            const montoTotal = card.getAttribute('data-monto-total');
            const fecha = card.getAttribute('data-fecha');
            const categoriaIcono = card.getAttribute('data-categoria-icono');
            const estado = card.getAttribute('data-estado');

            abrirModoEdicion('obligaciones', id, {
                entidad,
                monto_total: montoTotal,
                tipo: 'suscripcion',
                categoria_icono: categoriaIcono,
                fecha: fecha,
                estado: estado
            });
        });
    });
}

function renderHistorialFiltrado(tipo) {
    const titulo = document.getElementById('historial-titulo');
    if (titulo) {
        titulo.textContent = tipo === 'ingreso' ? 'Historial de Ingresos' : 'Historial de Egresos';
    }

    if (!tablaHistorialBody) return;
    tablaHistorialBody.innerHTML = '';

    const transacciones = transaccionesHistorial.filter(t => t.tipo_movimiento === tipo);
    if (transacciones.length === 0) {
        tablaHistorialBody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center py-12 text-on-surface-variant font-medium italic">
                    No hay transacciones registradas de tipo ${tipo === 'ingreso' ? 'ingreso' : 'egreso'}.
                </td>
            </tr>
        `;
        return;
    }

    transacciones.forEach(item => {
        const esIngreso = item.tipo_movimiento === 'ingreso';
        const colorTexto = esIngreso ? 'text-green-400 font-bold' : 'text-on-surface';
        const colorSigno = esIngreso ? '+' : '-';
        const bgIcono = esIngreso ? 'bg-green-400/10 text-green-400' : 'bg-error/10 text-error';
        const icono = esIngreso ? 'south_west' : 'restaurant';
        const colorBadgeTipo = esIngreso ? 'bg-green-400/10 text-green-400 border border-green-400/20' : 'bg-error/10 text-error border border-error/20';

        // Separar descripción y categoría
        let descripcion = item.descripcion;
        let categoria = '';
        const parts = item.descripcion.split(' - ');
        if (parts.length > 1) {
            descripcion = parts[0];
            categoria = parts[1];
        }

        tablaHistorialBody.innerHTML += `
            <tr class="historial-row hover:bg-surface-container-high transition-colors cursor-pointer group"
                data-id="${item.id}" data-descripcion="${item.descripcion}" data-monto="${item.monto}" data-tipo-movimiento="${item.tipo_movimiento}">
                <td class="px-6 py-4 font-body-md text-body-md text-on-surface-variant font-mono text-xs uppercase tracking-tighter">${item.fecha}</td>
                <td class="px-6 py-4">
                      <div class="flex items-center gap-3">
                          <div class="w-8 h-8 rounded-full ${bgIcono} flex items-center justify-center flex-shrink-0">
                              <span class="material-symbols-outlined text-[16px]">${icono}</span>
                          </div>
                          <div class="flex flex-col">
                              <span class="font-body-md text-body-md font-bold group-hover:text-primary transition-colors">${descripcion}</span>
                              ${categoria ? `<span class="px-1.5 py-0.5 mt-0.5 w-max rounded text-[9px] font-bold tracking-widest bg-outline-variant/30 text-on-surface-variant uppercase">${categoria}</span>` : ''}
                          </div>
                      </div>
                </td>
                <td class="px-6 py-4">
                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${colorBadgeTipo}">${item.tipo_movimiento}</span>
                </td>
                <td class="px-6 py-4 ${colorTexto} font-body-md text-body-md">${colorSigno}${formatoMoneda(Math.abs(item.monto))}</td>
            </tr>
        `;
    });
}

// Vinculación de Eventos del Sidebar
const menuInicio = document.getElementById('menu-inicio');
const menuFinanzas = document.getElementById('menu-finanzas');
const menuDeudas = document.getElementById('menu-deudas');
const menuSuscripciones = document.getElementById('menu-suscripciones');
const menuIngresos = document.getElementById('menu-ingresos');
const menuEgresos = document.getElementById('menu-egresos');
const menuConfiguracion = document.getElementById('menu-configuracion');

if (menuInicio) menuInicio.addEventListener('click', (e) => { e.preventDefault(); navegarA('inicio'); });
if (menuFinanzas) menuFinanzas.addEventListener('click', (e) => { e.preventDefault(); navegarA('finanzas'); });
if (menuDeudas) menuDeudas.addEventListener('click', (e) => { e.preventDefault(); navegarA('deudas'); });
if (menuSuscripciones) menuSuscripciones.addEventListener('click', (e) => { e.preventDefault(); navegarA('suscripciones'); });
if (menuIngresos) menuIngresos.addEventListener('click', (e) => { e.preventDefault(); navegarA('ingresos'); });
if (menuEgresos) menuEgresos.addEventListener('click', (e) => { e.preventDefault(); navegarA('egresos'); });
if (menuConfiguracion) menuConfiguracion.addEventListener('click', (e) => { e.preventDefault(); navegarA('configuracion'); });

// Ejecutar la carga cuando el DOM esté completamente listo
document.addEventListener('DOMContentLoaded', cargarDashboard);
