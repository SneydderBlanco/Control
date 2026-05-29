import { 
    fetchDashboardData, 
    crearObligacion, 
    crearTransaccion, 
    actualizarRegistro, 
    eliminarRegistro,
    fetchInversionesData,
    actualizarSaldoBetPlay,
    crearApuesta,
    actualizarEstadoApuesta,
    eliminarApuesta,
    loginUser,
    registerUser,
    fetchMe
} from './api.js';

// 0. Variables globales para el control de la SPA (Cuentas, Obligaciones, Historial, Calendario)
let todasObligaciones = [];
let transaccionesHistorial = [];
let todasCuentas = [];
let calendarioMesActual = new Date().getMonth();
let calendarioAnioActual = new Date().getFullYear();
let seccionActiva = 'inicio';
let fpInstance = null; // Instancia global de Flatpickr

// Variables para los Gráficos de Analítica (Chart.js)
let chartEgresos = null;
let chartBetPlay = null;

// Lógica de Autenticación
let authModo = 'login'; // 'login' o 'register'
let usuarioActual = null;

// Variables globales para el Módulo de Inversiones (BetPlay)
let moduloActivo = 'hub'; // 'hub', 'finanzas', 'inversiones'
let betplaySaldo = 0;
let betplayApuestas = [];
let betplayEstadisticas = {};
let filtroHistorialBetPlay = 'todos';


// 0.1 Control de Sidebar Drawer Responsivo para Dispositivos Móviles
document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('sidebar');
    const sidebarInversiones = document.getElementById('sidebar-inversiones');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
    const btnCloseSidebar = document.getElementById('btn-close-sidebar');
    const btnCloseSidebarInversiones = document.getElementById('btn-close-sidebar-inversiones');

    function cerrarSidebarMovil() {
        if (sidebar) {
            sidebar.classList.add('-translate-x-full');
            sidebar.classList.remove('translate-x-0');
        }
        if (sidebarInversiones) {
            sidebarInversiones.classList.add('-translate-x-full');
            sidebarInversiones.classList.remove('translate-x-0');
        }
        if (sidebarOverlay) {
            sidebarOverlay.classList.add('hidden');
        }
    }

    function abrirSidebarMovil() {
        if (sidebarOverlay) {
            sidebarOverlay.classList.remove('hidden');
        }
        if (moduloActivo === 'finanzas' && sidebar) {
            sidebar.classList.remove('-translate-x-full');
            sidebar.classList.add('translate-x-0');
        } else if (moduloActivo === 'inversiones' && sidebarInversiones) {
            sidebarInversiones.classList.remove('-translate-x-full');
            sidebarInversiones.classList.add('translate-x-0');
        }
    }

    if (btnToggleSidebar) {
        btnToggleSidebar.addEventListener('click', abrirSidebarMovil);
    }

    if (btnCloseSidebar) {
        btnCloseSidebar.addEventListener('click', cerrarSidebarMovil);
    }

    if (btnCloseSidebarInversiones) {
        btnCloseSidebarInversiones.addEventListener('click', cerrarSidebarMovil);
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', cerrarSidebarMovil);
    }

    // Cerrar sidebars al hacer clic en cualquier opción del menú en móviles
    document.querySelectorAll('#sidebar nav a, #sidebar-inversiones nav a').forEach(link => {
        link.addEventListener('click', cerrarSidebarMovil);
    });

    // 0.2 Inicializar Flatpickr en Español con Tema Oscuro Premium
    const dateInput = document.getElementById('fecha_vencimiento');
    if (dateInput) {
        fpInstance = flatpickr(dateInput, {
            locale: 'es',
            dateFormat: 'Y-m-d',
            altInput: true,
            altFormat: 'd \\de F, Y',
            disableMobile: true,
            theme: 'dark'
        });
    }
});

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
const dateElement = document.getElementById('header-date');
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

    // K. Actualizar gráficos analíticos de forma reactiva
    actualizarGraficoEgresos();
    actualizarGraficoBetPlay();
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
    const esDeuda = itemType === 'obligaciones' && data.tipo === 'deuda';
    const btnAbonarDeuda = document.getElementById('btn-abonar-deuda');
    
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

    if (btnAbonarDeuda) {
        if (esDeuda && data.estado !== 'pagado') {
            btnAbonarDeuda.classList.remove('hidden');
        } else {
            btnAbonarDeuda.classList.add('hidden');
        }
    }

    if (btnCancelar) {
        if (esSuscripcion || esDeuda) {
            btnCancelar.classList.add('hidden'); // Ocultar Cancelar clásico si es suscripción o deuda para liberar espacio
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
            const obligacion = todasObligaciones.find(o => String(o.id) === String(id));
            const fechaVenc = obligacion ? obligacion.fecha_vencimiento : '';
            if (fpInstance) {
                fpInstance.setDate(fechaVenc);
            } else if (inputFecha) {
                inputFecha.value = fechaVenc;
            }
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
        const btnAbonarDeuda = document.getElementById('btn-abonar-deuda');
        if (btnAbonarDeuda) {
            btnAbonarDeuda.classList.add('hidden');
        }
        if (btnCancelar) {
            btnCancelar.classList.remove('hidden');
        }
        document.getElementById('modal-titulo').textContent = 'Registrar';
        activarTab('obligacion');
        if (fpInstance) {
            fpInstance.clear();
        } else if (inputFecha) {
            inputFecha.value = '';
        }
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

// LÓGICA DE ACCIÓN: REGISTRAR ABONO / PAGO A DEUDA
const btnAbonarDeuda = document.getElementById('btn-abonar-deuda');
if (btnAbonarDeuda) {
    btnAbonarDeuda.addEventListener('click', async () => {
        const id = document.getElementById('modal-item-id').value;
        const obligacion = todasObligaciones.find(o => String(o.id) === String(id));
        if (!obligacion) return;

        const entidad = obligacion.entidad;
        const montoRestante = parseFloat(obligacion.monto_restante);

        // 1. Preguntar monto del abono
        const inputMontoStr = prompt(
            `Registrar Pago / Abono para "${entidad}"\n` +
            `Monto restante actual: ${formatoMoneda(montoRestante)}\n\n` +
            `¿Cuánto deseas pagar? (Ingresa solo números):`, 
            montoRestante
        );

        if (inputMontoStr === null) return; // Cancelado o Esc
        const montoAbono = parseFloat(inputMontoStr.replace(/[^0-9.]/g, ''));
        if (isNaN(montoAbono) || montoAbono <= 0) {
            alert('Por favor ingresa un monto válido mayor a 0.');
            return;
        }

        if (montoAbono > montoRestante) {
            alert(`El monto del abono no puede superar el saldo restante de la deuda (${formatoMoneda(montoRestante)}).`);
            return;
        }

        // 2. Preguntar la cuenta de origen
        // Filtrar solo cuentas reales (excluyendo BetPlay)
        const cuentasReales = todasCuentas.filter(c => c.id !== 'betplay' && !c.nombre.toLowerCase().includes('betplay'));
        let menuCuentas = 'Selecciona la cuenta para realizar el pago:\n\n';
        cuentasReales.forEach((c, index) => {
            menuCuentas += `${index + 1}. ${c.nombre} (Saldo: ${formatoMoneda(c.balance_actual)})\n`;
        });
        
        const seleccionCuentaStr = prompt(menuCuentas + '\nIngresa el número de tu opción (1, 2, 3...):');
        if (seleccionCuentaStr === null) return; // Cancelado
        
        const opcionIndex = parseInt(seleccionCuentaStr) - 1;
        if (isNaN(opcionIndex) || opcionIndex < 0 || opcionIndex >= cuentasReales.length) {
            alert('Opción de cuenta inválida.');
            return;
        }
        
        const cuentaElegida = cuentasReales[opcionIndex];
        
        // Verificar saldo de la cuenta
        if (cuentaElegida.balance_actual < montoAbono) {
            alert(`Saldo insuficiente en ${cuentaElegida.nombre} (Disponible: ${formatoMoneda(cuentaElegida.balance_actual)}) para realizar este pago.`);
            return;
        }

        // 3. Confirmar transacción
        if (confirm(`¿Confirmas el pago de ${formatoMoneda(montoAbono)} a la deudas "${entidad}" usando tu cuenta de ${cuentaElegida.nombre}?`)) {
            const data = {
                descripcion: `Abono Deuda - ${entidad}`,
                monto: montoAbono,
                tipo_movimiento: 'egreso',
                cuenta_id: cuentaElegida.id,
                categoria: 'Facturas',
                obligacion_id: obligacion.id
            };

            try {
                const response = await crearTransaccion(data);
                if (response) {
                    cerrarModal();
                    await cargarDashboard();
                    alert('¡Pago registrado con éxito y saldo de la deuda actualizado!');
                } else {
                    alert('Hubo un error al registrar el pago de la deuda.');
                }
            } catch (err) {
                alert(err.message || 'Error al procesar el pago.');
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

    // 1. Ocultar todas las secciones principales (Finanzas e Inversiones)
    const secciones = [
        'dashboard-principal',
        'calendario-seccion',
        'historial-seccion',
        'finanzas-seccion',
        'deudas-seccion',
        'suscripciones-seccion',
        'configuracion-seccion',
        'inversiones-betplay-seccion',
        'inversiones-historial-seccion',
        'inversiones-estadisticas-seccion'
    ];
    secciones.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });

    // 2. Restablecer estilos visuales del menú lateral (Finanzas o Inversiones)
    const menuIds = {
        inicio: 'menu-inicio',
        finanzas: 'menu-finanzas',
        deudas: 'menu-deudas',
        suscripciones: 'menu-suscripciones',
        ingresos: 'menu-ingresos',
        egresos: 'menu-egresos',
        configuracion: 'menu-configuracion',
        betplay: 'menu-inversiones-betplay',
        'inversiones-historial': 'menu-inversiones-historial',
        'inversiones-estadisticas': 'menu-inversiones-estadisticas'
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
    } else if (seccion === 'betplay') {
        const el = document.getElementById('inversiones-betplay-seccion');
        if (el) el.classList.remove('hidden');
        cargarInversiones();
    } else if (seccion === 'inversiones-historial') {
        const el = document.getElementById('inversiones-historial-seccion');
        if (el) el.classList.remove('hidden');
        cargarInversiones();
    } else if (seccion === 'inversiones-estadisticas') {
        const el = document.getElementById('inversiones-estadisticas-seccion');
        if (el) el.classList.remove('hidden');
        cargarInversiones();
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
        } else if (cuenta.id === 'betplay' || cuenta.nombre.toLowerCase().includes('betplay')) {
            colorBg = 'bg-gradient-to-br from-blue-950/35 via-surface-container/60 to-blue-900/10 border-blue-500/30 hover:border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.1)]';
            colorTexto = 'text-blue-400';
            icono = 'trending_up';
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

// Vinculación de Eventos del Sidebar (Módulo Financiero)
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


// ========================================================
// RENDERIZADO Y CONTROLADORES: MÓDULO INVERSIONES (BETPLAY)
// ========================================================

function navegarAModulo(modulo) {
    moduloActivo = modulo;
    
    const sidebarFinanzas = document.getElementById('sidebar');
    const sidebarInversiones = document.getElementById('sidebar-inversiones');
    const hubSeccion = document.getElementById('aura-hub-seccion');
    const mainEl = document.querySelector('main');
    const headerEl = document.querySelector('header');
    const headerTitle = document.getElementById('header-title');
    const fabAddBtn = document.getElementById('fab-add-button');
    
    // 1. Ocultar todas las vistas de finanzas e inversiones
    const seccionesFinanzas = [
        'dashboard-principal',
        'calendario-seccion',
        'historial-seccion',
        'finanzas-seccion',
        'deudas-seccion',
        'suscripciones-seccion',
        'configuracion-seccion'
    ];
    seccionesFinanzas.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    
    const seccionesInversiones = [
        'inversiones-betplay-seccion',
        'inversiones-historial-seccion',
        'inversiones-estadisticas-seccion'
    ];
    seccionesInversiones.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });

    if (modulo === 'hub') {
        // Ocultar sidebars
        if (sidebarFinanzas) sidebarFinanzas.classList.add('hidden');
        if (sidebarInversiones) sidebarInversiones.classList.add('hidden');
        
        // Mostrar Hub
        if (hubSeccion) hubSeccion.classList.remove('hidden');
        
        // Ajustar main y header para ancho completo sin sidebar
        if (mainEl) {
            mainEl.classList.remove('lg:ml-64');
            mainEl.classList.add('ml-0');
        }
        if (headerEl) {
            headerEl.classList.remove('lg:w-[calc(100%-16rem)]');
            headerEl.classList.add('w-full');
        }
        if (headerTitle) {
            headerTitle.textContent = "Aura Hub Central";
        }
        if (fabAddBtn) {
            fabAddBtn.classList.add('hidden');
        }
        seccionActiva = 'hub';
    } else if (modulo === 'finanzas') {
        // Mostrar sidebar finanzas, ocultar inversiones
        if (sidebarFinanzas) sidebarFinanzas.classList.remove('hidden');
        if (sidebarInversiones) sidebarInversiones.classList.add('hidden');
        
        // Ocultar hub
        if (hubSeccion) hubSeccion.classList.add('hidden');
        
        // Ajustar main y header para dejar espacio al sidebar
        if (mainEl) {
            mainEl.classList.add('lg:ml-64');
            mainEl.classList.remove('ml-0');
        }
        if (headerEl) {
            headerEl.classList.add('lg:w-[calc(100%-16rem)]');
            headerEl.classList.remove('w-full');
        }
        if (headerTitle) {
            const nombreSaludo = usuarioActual && usuarioActual.nombre ? usuarioActual.nombre : 'Christian';
            headerTitle.textContent = `¡Bienvenido, ${nombreSaludo}!`;
        }
        if (fabAddBtn) {
            fabAddBtn.classList.remove('hidden');
        }
        
        // Ir al inicio de finanzas
        navegarA('inicio');
    } else if (modulo === 'inversiones') {
        // Mostrar sidebar inversiones, ocultar finanzas
        if (sidebarFinanzas) sidebarFinanzas.classList.add('hidden');
        if (sidebarInversiones) sidebarInversiones.classList.remove('hidden');
        
        // Ocultar hub
        if (hubSeccion) hubSeccion.classList.add('hidden');
        
        // Ajustar main y header para dejar espacio al sidebar
        if (mainEl) {
            mainEl.classList.add('lg:ml-64');
            mainEl.classList.remove('ml-0');
        }
        if (headerEl) {
            headerEl.classList.add('lg:w-[calc(100%-16rem)]');
            headerEl.classList.remove('w-full');
        }
        if (headerTitle) {
            headerTitle.textContent = "Aura Bets (Inversiones)";
        }
        if (fabAddBtn) {
            fabAddBtn.classList.add('hidden');
        }
        
        // Ir al panel de BetPlay de inversiones
        navegarA('betplay');
    }
}

async function cargarInversiones() {
    const data = await fetchInversionesData();
    if (!data) return;

    betplaySaldo = data.saldoActual || 0;
    betplayApuestas = data.apuestas || [];
    betplayEstadisticas = data.estadisticas || {};

    // Renderizar Saldo en el panel
    const saldoEl = document.getElementById('betplay-saldo-html');
    if (saldoEl) {
        saldoEl.textContent = formatoMoneda(betplaySaldo) + ' COP';
    }

    // Renderizar resumen rápido en el panel
    const quickBeneficio = document.getElementById('quick-beneficio-html');
    if (quickBeneficio) {
        const beneficio = betplayEstadisticas.beneficio_neto || 0;
        quickBeneficio.textContent = formatoMoneda(beneficio);
        if (beneficio > 0) {
            quickBeneficio.className = "text-2xl font-extrabold text-green-400";
        } else if (beneficio < 0) {
            quickBeneficio.className = "text-2xl font-extrabold text-error";
        } else {
            quickBeneficio.className = "text-2xl font-extrabold text-on-surface";
        }
    }
    const quickWinRate = document.getElementById('quick-winrate-html');
    if (quickWinRate) {
        quickWinRate.textContent = `${betplayEstadisticas.winRate || 0}%`;
    }

    // Renderizar vistas según la sección activa
    if (seccionActiva === 'betplay') {
        renderApuestasActivas();
    } else if (seccionActiva === 'inversiones-historial') {
        renderHistorialBetPlay();
    } else if (seccionActiva === 'inversiones-estadisticas') {
        renderEstadisticasBetPlay();
    }
}

function renderApuestasActivas() {
    const container = document.getElementById('apuestas-activas-container');
    const badge = document.getElementById('cnt-activas-badge');
    if (!container) return;

    container.innerHTML = '';
    const activas = betplayApuestas.filter(a => a.estado === 'pendiente');
    
    if (badge) {
        badge.textContent = activas.length;
    }

    if (activas.length === 0) {
        container.innerHTML = `
            <div class="py-12 text-center text-on-surface-variant font-medium italic border border-dashed border-outline-variant/20 rounded-2xl">
                No tienes apuestas activas. ¡Registra una usando el formulario!
            </div>
        `;
        return;
    }

    activas.forEach(apuesta => {
        const retornoPosible = apuesta.valor_apostado * apuesta.cuota;
        container.innerHTML += `
            <div class="glass-panel p-5 rounded-2xl border border-outline-variant/30 bg-surface-container/20 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:border-secondary-container/40">
                <div class="space-y-1.5 flex-1">
                    <div class="flex items-center gap-2">
                        <span class="px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-500 font-bold text-[9px] uppercase tracking-wider border border-yellow-500/20">Pendiente</span>
                        <span class="text-on-surface-variant text-[10px] font-mono">${apuesta.fecha}</span>
                    </div>
                    <h4 class="font-body-md text-body-md font-bold text-on-surface">${apuesta.evento}</h4>
                    <p class="text-xs text-on-surface-variant">Pronóstico: <strong class="text-on-surface font-semibold">${apuesta.pronostico}</strong> (Cuota: ${apuesta.cuota.toFixed(2)})</p>
                </div>
                <div class="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 border-outline-variant/10 pt-3 md:pt-0">
                    <div class="text-left md:text-right">
                        <p class="text-[10px] text-on-surface-variant font-medium uppercase">Valor Apostado / Retorno</p>
                        <p class="font-body-md text-body-md font-bold text-on-surface mt-0.5">${formatoMoneda(apuesta.valor_apostado)} <span class="text-[10px] text-secondary-container font-semibold">➜ ${formatoMoneda(retornoPosible)}</span></p>
                    </div>
                    <div class="flex items-center gap-2">
                        <button class="btn-resolver-apuesta w-8 h-8 rounded-lg bg-green-400/20 border border-green-400/30 text-green-400 flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow" data-id="${apuesta.id}" data-estado="ganada" title="Marcar como Ganada">
                            <span class="material-symbols-outlined text-[16px]">check</span>
                        </button>
                        <button class="btn-resolver-apuesta w-8 h-8 rounded-lg bg-error/20 border border-error/30 text-error flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow" data-id="${apuesta.id}" data-estado="perdida" title="Marcar como Perdida">
                            <span class="material-symbols-outlined text-[16px]">close</span>
                        </button>
                        <button class="btn-eliminar-apuesta w-8 h-8 rounded-lg bg-outline-variant/20 border border-outline-variant/30 text-on-surface-variant flex items-center justify-center hover:scale-110 active:scale-95 transition-all" data-id="${apuesta.id}" title="Eliminar">
                            <span class="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    });

    // Registrar Event Listeners de resolución y eliminación
    container.querySelectorAll('.btn-resolver-apuesta').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-id');
            const estado = btn.getAttribute('data-estado');
            
            if (estado === 'ganada') {
                const apuesta = betplayApuestas.find(a => String(a.id) === String(id));
                if (!apuesta) return;
                
                const retornoCalculado = apuesta.valor_apostado * apuesta.cuota;
                
                const modalPayout = document.getElementById('modal-payout-resolution');
                const calculatedEl = document.getElementById('payout-modal-calculated');
                const inputReal = document.getElementById('payout-real-input');
                
                if (modalPayout && calculatedEl && inputReal) {
                    calculatedEl.textContent = formatoMoneda(retornoCalculado) + ' COP';
                    inputReal.value = retornoCalculado.toFixed(2);
                    modalPayout.classList.remove('hidden');
                    inputReal.focus();
                    inputReal.select();
                    
                    const btnConfirm = document.getElementById('btn-payout-confirm');
                    const btnCancel = document.getElementById('btn-payout-cancel');
                    
                    const handleConfirm = async () => {
                        const valorReal = parseFloat(inputReal.value);
                        modalPayout.classList.add('hidden');
                        cleanup();
                        try {
                            const res = await actualizarEstadoApuesta(id, 'ganada', isNaN(valorReal) ? retornoCalculado : valorReal);
                            if (res) {
                                await cargarInversiones();
                                await cargarDashboard(); // Para actualizar saldos y flujos reales
                            }
                        } catch (err) {
                            alert(err.message || 'Error al resolver la apuesta');
                        }
                    };
                    
                    const handleCancel = () => {
                        modalPayout.classList.add('hidden');
                        cleanup();
                    };
                    
                    const handleKeyPress = (e) => {
                        if (e.key === 'Enter') {
                            handleConfirm();
                        }
                    };
                    
                    const cleanup = () => {
                        btnConfirm.removeEventListener('click', handleConfirm);
                        btnCancel.removeEventListener('click', handleCancel);
                        inputReal.removeEventListener('keypress', handleKeyPress);
                    };
                    
                    btnConfirm.addEventListener('click', handleConfirm);
                    btnCancel.addEventListener('click', handleCancel);
                    inputReal.addEventListener('keypress', handleKeyPress);
                }
            } else {
                if (confirm(`¿Resolver esta apuesta como ${estado.toUpperCase()}? Esto afectará tu saldo simulado.`)) {
                    try {
                        const res = await actualizarEstadoApuesta(id, estado);
                        if (res) {
                            await cargarInversiones();
                            await cargarDashboard();
                        }
                    } catch (err) {
                        alert(err.message || 'Error al resolver la apuesta');
                    }
                }
            }
        });
    });

    container.querySelectorAll('.btn-eliminar-apuesta').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-id');
            if (confirm('¿Eliminar esta apuesta permanentemente? Si estaba pendiente, se devolverá tu dinero al saldo.')) {
                try {
                    const res = await eliminarApuesta(id);
                    if (res) {
                        await cargarInversiones();
                    }
                } catch (err) {
                    alert(err.message || 'Error al eliminar la apuesta');
                }
            }
        });
    });
}

function renderHistorialBetPlay() {
    const tbody = document.getElementById('historial-apuestas-tbody');
    const emptyState = document.getElementById('historial-vacio-state');
    if (!tbody) return;

    tbody.innerHTML = '';
    
    // Filtrar por filtroHistorialBetPlay ('todos', 'ganada', 'perdida')
    let filtradas = betplayApuestas.filter(a => a.estado !== 'pendiente');
    if (filtroHistorialBetPlay !== 'todos') {
        filtradas = filtradas.filter(a => a.estado === filtroHistorialBetPlay);
    }

    if (filtradas.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    filtradas.forEach(apuesta => {
        const esGanada = apuesta.estado === 'ganada';
        const badgeStyle = esGanada 
            ? 'bg-green-400/20 text-green-400 border border-green-400/20' 
            : 'bg-error/20 text-error border border-error/20';
        
        const retorno = esGanada ? (apuesta.retorno_real !== null && apuesta.retorno_real !== undefined ? parseFloat(apuesta.retorno_real) : (apuesta.valor_apostado * apuesta.cuota)) : 0;
        const retornoTexto = esGanada ? formatoMoneda(retorno) : '$0';
        const retornoColor = esGanada ? 'text-green-400 font-bold' : 'text-on-surface-variant';

        tbody.innerHTML += `
            <tr class="hover:bg-surface-container-high/40 transition-colors border-b border-outline-variant/10">
                <td class="py-4 px-6 text-xs text-on-surface-variant font-mono">${apuesta.fecha}</td>
                <td class="py-4 px-6 font-semibold text-on-surface">${apuesta.evento}</td>
                <td class="py-4 px-6 text-xs text-on-surface-variant">${apuesta.pronostico}</td>
                <td class="py-4 px-6 text-center font-mono text-xs font-bold text-secondary-container">${apuesta.cuota.toFixed(2)}</td>
                <td class="py-4 px-6 text-right font-medium text-on-surface">${formatoMoneda(apuesta.valor_apostado)}</td>
                <td class="py-4 px-6 text-center">
                    <span class="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${badgeStyle}">
                        ${apuesta.estado}
                    </span>
                </td>
                <td class="py-4 px-6 text-right font-bold ${retornoColor}">${retornoTexto}</td>
                <td class="py-4 px-6 text-center">
                    <button class="btn-eliminar-apuesta-historial text-on-surface-variant hover:text-error transition-colors" data-id="${apuesta.id}">
                        <span class="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                </td>
            </tr>
        `;
    });

    tbody.querySelectorAll('.btn-eliminar-apuesta-historial').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-id');
            if (confirm('¿Eliminar este registro de tu historial de forma permanente? El saldo no se modificará ya que esta apuesta ya fue liquidada.')) {
                try {
                    const res = await eliminarApuesta(id);
                    if (res) {
                        await cargarInversiones();
                    }
                } catch (err) {
                    alert(err.message || 'Error al eliminar la apuesta');
                }
            }
        });
    });
}

function renderEstadisticasBetPlay() {
    const winRateEl = document.getElementById('stats-winrate-html');
    const yieldEl = document.getElementById('stats-yield-html');
    const beneficioEl = document.getElementById('stats-beneficio-html');
    const invertidoEl = document.getElementById('stats-invertido-html');

    const cntPendientes = document.getElementById('stats-cnt-pendientes');
    const cntGanadas = document.getElementById('stats-cnt-ganadas');
    const cntPerdidas = document.getElementById('stats-cnt-perdidas');
    const cntTotal = document.getElementById('stats-cnt-total');

    if (winRateEl) winRateEl.textContent = `${betplayEstadisticas.winRate || 0}%`;
    
    if (yieldEl) {
        const yieldVal = betplayEstadisticas.yield || 0;
        yieldEl.textContent = `${yieldVal > 0 ? '+' : ''}${yieldVal}%`;
        if (yieldVal > 0) {
            yieldEl.className = "text-4xl font-extrabold text-green-400";
        } else if (yieldVal < 0) {
            yieldEl.className = "text-4xl font-extrabold text-error";
        } else {
            yieldEl.className = "text-4xl font-extrabold text-on-surface";
        }
    }

    if (beneficioEl) {
        const beneficio = betplayEstadisticas.beneficio_neto || 0;
        beneficioEl.textContent = formatoMoneda(beneficio);
        if (beneficio > 0) {
            beneficioEl.className = "text-4xl font-extrabold text-green-400";
        } else if (beneficio < 0) {
            beneficioEl.className = "text-4xl font-extrabold text-error";
        } else {
            beneficioEl.className = "text-4xl font-extrabold text-on-surface";
        }
    }

    if (invertidoEl) {
        invertidoEl.textContent = formatoMoneda(betplayEstadisticas.total_invertido || 0);
    }

    if (cntPendientes) cntPendientes.textContent = betplayEstadisticas.apuestas_pendientes || 0;
    if (cntGanadas) cntGanadas.textContent = betplayEstadisticas.apuestas_ganadas || 0;
    if (cntPerdidas) cntPerdidas.textContent = betplayEstadisticas.apuestas_perdidas || 0;
    if (cntTotal) cntTotal.textContent = betplayEstadisticas.total_apuestas || 0;
}


// Oyentes para el Módulo de Saldo BetPlay
const formBetPlaySaldo = document.getElementById('form-betplay-saldo');
const modalBetPlaySaldo = document.getElementById('modal-betplay-saldo');

function popularCuentasRealesEnModal(tipo) {
    const labelCuenta = document.getElementById('label-betplay-saldo-cuenta');
    if (labelCuenta) {
        labelCuenta.textContent = tipo === 'deposito' ? 'Cuenta de Origen' : 'Cuenta de Destino';
    }
    const selectCuenta = document.getElementById('betplay-saldo-cuenta-id');
    if (selectCuenta) {
        selectCuenta.innerHTML = '';
        // Filtrar solo cuentas REALES (excluyendo la cuenta virtual de BetPlay)
        const cuentasReales = todasCuentas.filter(c => c.id !== 'betplay' && !c.nombre.toLowerCase().includes('betplay'));
        if (cuentasReales.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No hay cuentas disponibles';
            selectCuenta.appendChild(option);
        } else {
            cuentasReales.forEach(c => {
                const option = document.createElement('option');
                option.value = c.id;
                option.textContent = `${c.nombre} (${formatoMoneda(c.balance_actual)})`;
                selectCuenta.appendChild(option);
            });
        }
    }
}

if (formBetPlaySaldo) {
    formBetPlaySaldo.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(formBetPlaySaldo);
        const monto = parseFloat(formData.get('monto'));
        const tipo = formData.get('tipo_movimiento');
        const cuentaId = formData.get('cuenta_id');
        
        if (isNaN(monto) || monto <= 0) return;
        
        try {
            const res = await actualizarSaldoBetPlay(monto, tipo, cuentaId);
            if (res) {
                modalBetPlaySaldo.classList.add('hidden');
                formBetPlaySaldo.reset();
                await cargarInversiones();
                await cargarDashboard();
            }
        } catch (err) {
            alert(err.message || 'Error al actualizar saldo');
        }
    });
}

const btnRecargar = document.getElementById('btn-betplay-recargar');
const btnRetirar = document.getElementById('btn-betplay-retirar');
const modalBetPlayTitulo = document.getElementById('modal-betplay-titulo');
const modalBetPlayDesc = document.getElementById('modal-betplay-descripcion');
const inputSaldoTipo = document.getElementById('betplay-saldo-tipo-movimiento');
const btnCancelarBetPlaySaldo = document.getElementById('btn-betplay-cancelar-modal');

if (btnRecargar && modalBetPlaySaldo) {
    btnRecargar.addEventListener('click', () => {
        modalBetPlayTitulo.textContent = 'Recargar Saldo (Simulado)';
        modalBetPlayDesc.textContent = 'Ingresa el monto simulado para recargar tu cuenta de BetPlay.';
        if (inputSaldoTipo) inputSaldoTipo.value = 'deposito';
        popularCuentasRealesEnModal('deposito');
        modalBetPlaySaldo.classList.remove('hidden');
    });
}

if (btnRetirar && modalBetPlaySaldo) {
    btnRetirar.addEventListener('click', () => {
        modalBetPlayTitulo.textContent = 'Retirar Saldo (Simulado)';
        modalBetPlayDesc.textContent = 'Ingresa el monto simulado para retirar de tu cuenta de BetPlay.';
        if (inputSaldoTipo) inputSaldoTipo.value = 'retiro';
        popularCuentasRealesEnModal('retiro');
        modalBetPlaySaldo.classList.remove('hidden');
    });
}

if (btnCancelarBetPlaySaldo && modalBetPlaySaldo) {
    btnCancelarBetPlaySaldo.addEventListener('click', () => {
        modalBetPlaySaldo.classList.add('hidden');
        if (formBetPlaySaldo) formBetPlaySaldo.reset();
    });
}

if (modalBetPlaySaldo) {
    modalBetPlaySaldo.addEventListener('click', (e) => {
        if (e.target === modalBetPlaySaldo) {
            modalBetPlaySaldo.classList.add('hidden');
            if (formBetPlaySaldo) formBetPlaySaldo.reset();
        }
    });
}

// Oyentes para el Formulario de Registrar Apuesta
// Variable global para capturar la apuesta que está en espera de confirmación de riesgo
let apuestaPendienteRiesgo = null;

// Helper para validar dinámicamente el riesgo en el formulario como se digita
function validarRiesgoApuesta() {
    const inputMonto = document.getElementById('apuesta-monto');
    const inputCuota = document.getElementById('apuesta-cuota');
    const alertEl = document.getElementById('apuesta-risk-alert');
    const alertTextEl = document.getElementById('apuesta-risk-alert-text');
    
    if (!inputMonto || !inputCuota || !alertEl || !alertTextEl) return;

    const monto = parseFloat(inputMonto.value);
    const cuota = parseFloat(inputCuota.value);

    if (isNaN(monto) || monto <= 0 || betplaySaldo <= 0) {
        alertEl.classList.add('hidden');
        return;
    }

    const porcentajeBanca = (monto / betplaySaldo) * 100;
    
    if (porcentajeBanca >= 5) {
        alertEl.classList.remove('hidden');
        if (!isNaN(cuota) && cuota > 5.00) {
            const stake1 = formatoMoneda(betplaySaldo * 0.01);
            const stake2 = formatoMoneda(betplaySaldo * 0.02);
            alertTextEl.innerHTML = `<strong>🛑 CRÍTICO - RIESGO EXTREMO (Cuota > 5.0):</strong> Estás arriesgando un <strong>${porcentajeBanca.toFixed(1)}%</strong> de tu capital en una cuota con muy baja probabilidad estadística. ¡Peligro de ruina! Se sugiere un stake ultra-conservador del 1% o 2% (entre ${stake1} y ${stake2}).`;
            alertEl.className = "p-3 rounded-xl bg-error-container/20 border border-error/50 text-error text-[11px] font-semibold flex items-start gap-2 premium-card-glow";
        } else {
            const limite5 = formatoMoneda(betplaySaldo * 0.05);
            alertTextEl.innerHTML = `<strong>⚠️ Alerta de Staking:</strong> Estás arriesgando el <strong>${porcentajeBanca.toFixed(1)}%</strong> de tu bankroll. Se recomienda no exceder el 5% (${limite5}) por apuesta.`;
            alertEl.className = "p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-[11px] font-semibold flex items-start gap-2";
        }
    } else {
        alertEl.classList.add('hidden');
    }
}

// Oyentes para el Formulario de Registrar Apuesta
const formRegistrarApuesta = document.getElementById('form-registrar-apuesta');
if (formRegistrarApuesta) {
    const inputMonto = document.getElementById('apuesta-monto');
    const inputCuota = document.getElementById('apuesta-cuota');

    if (inputMonto) inputMonto.addEventListener('input', validarRiesgoApuesta);
    if (inputCuota) inputCuota.addEventListener('input', validarRiesgoApuesta);

    formRegistrarApuesta.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const data = {
            evento: document.getElementById('apuesta-evento').value,
            pronostico: document.getElementById('apuesta-pronostico').value,
            cuota: parseFloat(document.getElementById('apuesta-cuota').value),
            valor_apostado: parseFloat(document.getElementById('apuesta-monto').value)
        };

        if (!data.evento || !data.pronostico || isNaN(data.cuota) || isNaN(data.valor_apostado)) {
            alert('Por favor, completa todos los campos correctamente.');
            return;
        }

        if (data.valor_apostado > betplaySaldo) {
            alert('Saldo insuficiente en tu cuenta simulada de BetPlay para realizar esta apuesta.');
            return;
        }

        const porcentajeBanca = (data.valor_apostado / betplaySaldo) * 100;

        if (porcentajeBanca >= 5) {
            // Interceptar y mostrar la modal de advertencia glassmorphic
            apuestaPendienteRiesgo = data;
            const modalRisk = document.getElementById('modal-risk-warning');
            const riskTitulo = document.getElementById('risk-modal-titulo');
            const riskIcono = document.getElementById('risk-modal-icon');
            const riskMensaje = document.getElementById('risk-modal-mensaje');

            if (modalRisk) {
                if (data.cuota > 5.00) {
                    const stake1 = formatoMoneda(betplaySaldo * 0.01);
                    const stake2 = formatoMoneda(betplaySaldo * 0.02);
                    if (riskTitulo) riskTitulo.textContent = 'Alerta Ultra-Estricta de Riesgo Crítico';
                    if (riskIcono) riskIcono.textContent = 'bolt';
                    if (riskIcono) {
                        riskIcono.parentElement.className = 'w-16 h-16 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto animate-pulse';
                    }
                    if (riskMensaje) {
                        riskMensaje.innerHTML = `🛑 <strong>ALERTA ULTRA-ESTRICTA DE RIESGO CRÍTICO:</strong> Has ingresado una cuota extremadamente alta de <strong>${data.cuota.toFixed(2)}</strong>. Estadísticamente, la probabilidad de acierto para cuotas superiores a 5.00 es menor al 15%-20%, lo que expone tu bankroll a una ruina matemática casi segura bajo un Staking del 5% o superior (estás arriesgando el <strong>${porcentajeBanca.toFixed(1)}%</strong>).<br><br><strong>ACCIÓN RECOMENDADA POR EL SISTEMA DE RIESGO:</strong> Reduce inmediatamente tu nivel de exposición a un stake conservador del <strong>1% o 2%</strong> (entre <strong>${stake1}</strong> y <strong>${stake2} COP</strong>) para blindar tu capital ante la varianza negativa.<br><br>¿Deseas corregir el monto para proteger tu cuenta o asumir el riesgo extremo bajo tu propia responsabilidad?`;
                    }
                } else {
                    const limite5 = formatoMoneda(betplaySaldo * 0.05);
                    if (riskTitulo) riskTitulo.textContent = 'Alerta de Bankroll (Staking)';
                    if (riskIcono) riskIcono.textContent = 'warning';
                    if (riskIcono) {
                        riskIcono.parentElement.className = 'w-16 h-16 rounded-full bg-yellow-500/20 text-yellow-400 flex items-center justify-center mx-auto animate-pulse';
                    }
                    if (riskMensaje) {
                        riskMensaje.innerHTML = `La apuesta propuesta es de <strong>${formatoMoneda(data.valor_apostado)}</strong>, lo que representa el <strong>${porcentajeBanca.toFixed(1)}%</strong> de tu saldo disponible (<strong>${formatoMoneda(betplaySaldo)}</strong>).<br><br>Arriesgar más del 5% del bankroll (máximo sugerido: <strong>${limite5} COP</strong>) incrementa significativamente el riesgo de pérdida total del capital.<br><br>¿Deseas corregir el monto o continuar de todos modos?`;
                    }
                }
                modalRisk.classList.remove('hidden');
            }
            return;
        }

        // Si cumple la regla de bankroll, procesa directamente
        await procesarColocacionApuesta(data);
    });
}

async function procesarColocacionApuesta(data) {
    try {
        const res = await crearApuesta(data);
        if (res) {
            formRegistrarApuesta.reset();
            const alertEl = document.getElementById('apuesta-risk-alert');
            if (alertEl) alertEl.classList.add('hidden');
            await cargarInversiones();
        }
    } catch (err) {
        alert(err.message || 'Error al registrar la apuesta');
    }
}

// Oyentes para botones del modal de riesgo
const btnRiskCorrect = document.getElementById('btn-risk-correct');
const btnRiskContinue = document.getElementById('btn-risk-continue');
const modalRiskEl = document.getElementById('modal-risk-warning');

if (btnRiskCorrect) {
    btnRiskCorrect.addEventListener('click', () => {
        if (modalRiskEl) modalRiskEl.classList.add('hidden');
        apuestaPendienteRiesgo = null;
        const inputMonto = document.getElementById('apuesta-monto');
        if (inputMonto) inputMonto.focus();
    });
}

if (btnRiskContinue) {
    btnRiskContinue.addEventListener('click', async () => {
        if (modalRiskEl) modalRiskEl.classList.add('hidden');
        if (apuestaPendienteRiesgo) {
            await procesarColocacionApuesta(apuestaPendienteRiesgo);
            apuestaPendienteRiesgo = null;
        }
    });
}

// Vinculación de clics en las tarjetas del Aura Hub Portal
const btnHubFinanzas = document.getElementById('btn-hub-finanzas');
const btnHubInversiones = document.getElementById('btn-hub-inversiones');

if (btnHubFinanzas) {
    btnHubFinanzas.addEventListener('click', () => navegarAModulo('finanzas'));
}

if (btnHubInversiones) {
    btnHubInversiones.addEventListener('click', () => navegarAModulo('inversiones'));
}

// Vinculación de clics en los botones "Volver al Portal"
const btnSidebarBackHub = document.getElementById('btn-sidebar-back-hub');
const btnSidebarInversionesBackHub = document.getElementById('btn-sidebar-inversiones-back-hub');

if (btnSidebarBackHub) {
    btnSidebarBackHub.addEventListener('click', (e) => {
        e.preventDefault();
        navegarAModulo('hub');
    });
}

if (btnSidebarInversionesBackHub) {
    btnSidebarInversionesBackHub.addEventListener('click', (e) => {
        e.preventDefault();
        navegarAModulo('hub');
    });
}

// Vinculación de clics en el Sidebar de Inversiones (Aura Bets)
const menuInvBetPlay = document.getElementById('menu-inversiones-betplay');
const menuInvHistorial = document.getElementById('menu-inversiones-historial');
const menuInvStats = document.getElementById('menu-inversiones-estadisticas');

if (menuInvBetPlay) {
    menuInvBetPlay.addEventListener('click', (e) => {
        e.preventDefault();
        navegarA('betplay');
    });
}
if (menuInvHistorial) {
    menuInvHistorial.addEventListener('click', (e) => {
        e.preventDefault();
        navegarA('inversiones-historial');
    });
}
if (menuInvStats) {
    menuInvStats.addEventListener('click', (e) => {
        e.preventDefault();
        navegarA('inversiones-estadisticas');
    });
}

const btnVerStatsInversiones = document.getElementById('btn-betplay-ver-stats');
if (btnVerStatsInversiones) {
    btnVerStatsInversiones.addEventListener('click', () => {
        navegarA('inversiones-estadisticas');
    });
}

const filtroHistorialEstado = document.getElementById('filtro-historial-estado');
if (filtroHistorialEstado) {
    filtroHistorialEstado.addEventListener('change', (e) => {
        filtroHistorialBetPlay = e.target.value;
        renderHistorialBetPlay();
    });
}


// ==========================================================================
// SECCIÓN DE AUTENTICACIÓN Y GESTIÓN DE SESIÓN (NUEVO)
// ==========================================================================

async function verificarAutenticacion() {
    const token = localStorage.getItem('token');
    const authContainer = document.getElementById('auth-container');
    const headerTitle = document.getElementById('header-title');

    if (!token) {
        if (authContainer) authContainer.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
        return false;
    }

    const user = await fetchMe();
    if (!user) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if (authContainer) authContainer.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
        return false;
    }

    usuarioActual = user;
    localStorage.setItem('user', JSON.stringify(user));
    if (authContainer) authContainer.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
    
    // Cambiar saludo en el header
    if (headerTitle) {
        headerTitle.textContent = `¡Bienvenido, ${user.nombre}!`;
    }
    const headerAvatarChar = document.getElementById('header-user-avatar-char');
    if (headerAvatarChar && user.nombre) {
        headerAvatarChar.textContent = user.nombre.trim().charAt(0).toUpperCase();
    }

    // Actualizar nombre en el panel de configuración
    const configNombre = document.getElementById('config-nombre-usuario');
    if (configNombre) {
        configNombre.textContent = user.nombre;
    }
    const configAvatarChar = document.getElementById('config-user-avatar-char');
    if (configAvatarChar && user.nombre) {
        configAvatarChar.textContent = user.nombre.trim().charAt(0).toUpperCase();
    }

    // Cargar los datos dinámicos de forma segura
    await cargarDashboard();
    await cargarInversiones();
    return true;
}

function cerrarSesion() {
    if (confirm('¿Estás seguro de que deseas cerrar sesión en Aura Hub?')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        // Destruir gráficos previos para evitar fugas de memoria o caché
        if (chartEgresos) {
            chartEgresos.destroy();
            chartEgresos = null;
        }
        if (chartBetPlay) {
            chartBetPlay.destroy();
            chartBetPlay = null;
        }

        // Forzar recarga visual limpia
        window.location.reload();
    }
}

// ==========================================================================
// GRÁFICOS ANALÍTICOS (CHART.JS - NUEVO)
// ==========================================================================

function actualizarGraficoEgresos() {
    const canvas = document.getElementById('chart-egresos-categorias');
    const noDataEl = document.getElementById('chart-egresos-no-data');
    if (!canvas) return;

    // Obtener los egresos del historial de transacciones del MES en curso
    const hoy = new Date();
    const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const mesActualStr = meses[hoy.getMonth()]; // ej: "may"
    const anioActual = hoy.getFullYear();

    const egresosDelMes = transaccionesHistorial.filter(t => {
        const esEgreso = t.tipo_movimiento === 'egreso';
        const contieneMes = t.fecha && t.fecha.toLowerCase().includes(mesActualStr);
        const contieneAnio = t.fecha && t.fecha.includes(String(anioActual));
        return esEgreso && contieneMes && contieneAnio;
    });

    if (egresosDelMes.length === 0) {
        if (noDataEl) noDataEl.classList.remove('hidden');
        if (chartEgresos) {
            chartEgresos.destroy();
            chartEgresos = null;
        }
        return;
    }

    if (noDataEl) noDataEl.classList.add('hidden');

    // Agrupar por categoría
    const categorias = {};
    egresosDelMes.forEach(t => {
        let cat = 'Otros';
        const parts = t.descripcion.split(' - ');
        if (parts.length > 1) {
            cat = parts[1];
        } else if (t.descripcion.startsWith('Pago mensual -')) {
            cat = 'Suscripciones';
        } else if (t.descripcion.toLowerCase().includes('apuesta')) {
            cat = 'Apuestas';
        } else if (t.descripcion.toLowerCase().includes('recarga')) {
            cat = 'Inversión';
        }
        const montoAbs = Math.abs(t.monto);
        categorias[cat] = (categorias[cat] || 0) + montoAbs;
    });

    const labels = Object.keys(categorias);
    const data = Object.values(categorias);

    if (labels.length === 0) {
        if (noDataEl) noDataEl.classList.remove('hidden');
        return;
    }

    // Paleta de colores Premium de Aura Hub
    const colors = [
        '#adc6ff', // primary (azul claro)
        '#c4abff', // secondary (violeta claro)
        '#ffb4ab', // error (rosa suave)
        '#689fff', // azul eléctrico
        '#e2e2e9', // gris claro
        '#571bc1'  // violeta profundo
    ];

    if (chartEgresos) {
        chartEgresos.data.labels = labels;
        chartEgresos.data.datasets[0].data = data;
        chartEgresos.update();
    } else {
        const ctx = canvas.getContext('2d');
        chartEgresos = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors.slice(0, labels.length),
                    borderWidth: 2,
                    borderColor: '#131315', 
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#c2c6d6',
                            font: {
                                family: 'Inter',
                                size: 10
                            },
                            boxWidth: 10
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return ` ${context.label}: ${formatoMoneda(context.raw)}`;
                            }
                        }
                    }
                },
                cutout: '65%'
            }
        });
    }
}

async function actualizarGraficoBetPlay() {
    const canvas = document.getElementById('chart-tendencia-betplay');
    const noDataEl = document.getElementById('chart-betplay-no-data');
    if (!canvas) return;

    // Cargar apuestas históricas si no están presentes
    if (!betplayApuestas || betplayApuestas.length === 0) {
        const invData = await fetchInversionesData();
        if (invData) {
            betplayApuestas = invData.apuestas || [];
        }
    }

    // Filtrar solo apuestas resueltas ('ganada' o 'perdida') y ordenarlas cronológicamente
    const apuestasResueltas = betplayApuestas
        .filter(a => a.estado === 'ganada' || a.estado === 'perdida')
        .sort((a, b) => new Date(a.fecha_registro || a.fecha) - new Date(b.fecha_registro || b.fecha));

    if (apuestasResueltas.length === 0) {
        if (noDataEl) noDataEl.classList.remove('hidden');
        if (chartBetPlay) {
            chartBetPlay.destroy();
            chartBetPlay = null;
        }
        return;
    }

    if (noDataEl) noDataEl.classList.add('hidden');

    // Calcular beneficio acumulado paso a paso
    let acumulado = 0;
    const datosBeneficio = [0];
    const etiquetas = ['Inicio'];

    apuestasResueltas.forEach((a, index) => {
        if (a.estado === 'ganada') {
            const ret = a.retorno_real !== null && a.retorno_real !== undefined ? parseFloat(a.retorno_real) : (parseFloat(a.valor_apostado) * parseFloat(a.cuota));
            acumulado += ret - parseFloat(a.valor_apostado);
        } else if (a.estado === 'perdida') {
            acumulado -= parseFloat(a.valor_apostado);
        }
        datosBeneficio.push(acumulado);
        
        const dateObj = new Date(a.fecha_registro || a.fecha);
        const dia = dateObj.getDate();
        const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const mes = meses[dateObj.getMonth()];
        etiquetas.push(`${dia} ${mes} (${index + 1}º)`);
    });

    if (chartBetPlay) {
        chartBetPlay.data.labels = etiquetas;
        chartBetPlay.data.datasets[0].data = datosBeneficio;
        chartBetPlay.update();
    } else {
        const ctx = canvas.getContext('2d');
        
        // Crear gradiente de fondo premium
        const gradient = ctx.createLinearGradient(0, 0, 0, 250);
        gradient.addColorStop(0, 'rgba(196, 171, 255, 0.25)'); 
        gradient.addColorStop(1, 'rgba(196, 171, 255, 0.0)');

        chartBetPlay = new Chart(ctx, {
            type: 'line',
            data: {
                labels: etiquetas,
                datasets: [{
                    label: 'Beneficio Neto',
                    data: datosBeneficio,
                    borderColor: '#c4abff', 
                    borderWidth: 2.5,
                    backgroundColor: gradient,
                    fill: true,
                    tension: 0.35,
                    pointBackgroundColor: '#c4abff',
                    pointBorderColor: '#131315',
                    pointBorderWidth: 1.5,
                    pointRadius: 3.5,
                    pointHoverRadius: 5.5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return ` Beneficio Acumulado: ${formatoMoneda(context.raw)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(66, 71, 84, 0.1)',
                            borderColor: 'transparent'
                        },
                        ticks: {
                            color: '#c2c6d6',
                            font: { size: 8 }
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(66, 71, 84, 0.1)',
                            borderColor: 'transparent'
                        },
                        ticks: {
                            color: '#c2c6d6',
                            font: { size: 8 },
                            callback: function(value) {
                                return formatoMoneda(value);
                            }
                        }
                    }
                }
            }
        });
    }
}

// ==========================================================================
// INICIALIZACIÓN Y BINDING DE EVENTOS (NUEVO / REFACTORIZADO)
// ==========================================================================

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Control de Sidebar Drawer Responsivo
    const sidebar = document.getElementById('sidebar');
    const sidebarInversiones = document.getElementById('sidebar-inversiones');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
    const btnCloseSidebar = document.getElementById('btn-close-sidebar');
    const btnCloseSidebarInversiones = document.getElementById('btn-close-sidebar-inversiones');

    function cerrarSidebarMovil() {
        if (sidebar) {
            sidebar.classList.add('-translate-x-full');
            sidebar.classList.remove('translate-x-0');
        }
        if (sidebarInversiones) {
            sidebarInversiones.classList.add('-translate-x-full');
            sidebarInversiones.classList.remove('translate-x-0');
        }
        if (sidebarOverlay) {
            sidebarOverlay.classList.add('hidden');
        }
    }

    function abrirSidebarMovil() {
        if (sidebarOverlay) {
            sidebarOverlay.classList.remove('hidden');
        }
        if (moduloActivo === 'finanzas' && sidebar) {
            sidebar.classList.remove('-translate-x-full');
            sidebar.classList.add('translate-x-0');
        } else if (moduloActivo === 'inversiones' && sidebarInversiones) {
            sidebarInversiones.classList.remove('-translate-x-full');
            sidebarInversiones.classList.add('translate-x-0');
        }
    }

    if (btnToggleSidebar) btnToggleSidebar.addEventListener('click', abrirSidebarMovil);
    if (btnCloseSidebar) btnCloseSidebar.addEventListener('click', cerrarSidebarMovil);
    if (btnCloseSidebarInversiones) btnCloseSidebarInversiones.addEventListener('click', cerrarSidebarMovil);
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', cerrarSidebarMovil);

    document.querySelectorAll('#sidebar nav a, #sidebar-inversiones nav a').forEach(link => {
        link.addEventListener('click', cerrarSidebarMovil);
    });

    // 2. Control de los Formularios de Autenticación
    const authContainer = document.getElementById('auth-container');
    const formAuth = document.getElementById('form-auth');
    const btnAuthToggle = document.getElementById('btn-auth-toggle');
    const btnAuthSubmit = document.getElementById('btn-auth-submit');
    const authErrorAlert = document.getElementById('auth-error-alert');
    const authErrorMessage = document.getElementById('auth-error-message');

    if (btnAuthToggle) {
        btnAuthToggle.addEventListener('click', () => {
            const authTitulo = document.getElementById('auth-titulo');
            const authSubtitulo = document.getElementById('auth-subtitulo');
            const authWrapperNombre = document.getElementById('auth-wrapper-nombre');
            const btnAuthText = document.getElementById('btn-auth-text');
            const authTogglePrompt = document.getElementById('auth-toggle-prompt');
            const authNombre = document.getElementById('auth-nombre');

            if (authModo === 'login') {
                authModo = 'register';
                if (authTitulo) authTitulo.textContent = 'Crear Cuenta';
                if (authSubtitulo) authSubtitulo.textContent = 'Regístrate para asegurar tu control patrimonial.';
                if (authWrapperNombre) authWrapperNombre.classList.remove('hidden');
                if (authNombre) authNombre.required = true;
                if (btnAuthText) btnAuthText.textContent = 'Registrarse y Comenzar';
                if (authTogglePrompt) authTogglePrompt.textContent = '¿Ya tienes una cuenta?';
                btnAuthToggle.textContent = 'Iniciar Sesión';
            } else {
                authModo = 'login';
                if (authTitulo) authTitulo.textContent = 'Iniciar Sesión';
                if (authSubtitulo) authSubtitulo.textContent = 'Gestiona tu patrimonio con seguridad de nivel bancario.';
                if (authWrapperNombre) authWrapperNombre.classList.add('hidden');
                if (authNombre) authNombre.required = false;
                if (btnAuthText) btnAuthText.textContent = 'Ingresar al Sistema';
                if (authTogglePrompt) authTogglePrompt.textContent = '¿No tienes una cuenta aún?';
                btnAuthToggle.textContent = 'Registrarse gratis';
            }
            if (authErrorAlert) authErrorAlert.classList.add('hidden');
        });
    }

    if (formAuth) {
        formAuth.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('auth-email').value;
            const password = document.getElementById('auth-password').value;
            const nombre = document.getElementById('auth-nombre').value;

            if (authErrorAlert) authErrorAlert.classList.add('hidden');
            if (btnAuthSubmit) btnAuthSubmit.disabled = true;

            try {
                let responseData;
                if (authModo === 'login') {
                    responseData = await loginUser(email, password);
                } else {
                    responseData = await registerUser(nombre, email, password);
                }

                if (responseData && responseData.token) {
                    localStorage.setItem('token', responseData.token);
                    localStorage.setItem('user', JSON.stringify(responseData.user));
                    
                    formAuth.reset();
                    await verificarAutenticacion();
                }
            } catch (err) {
                console.error('Error de autenticación:', err);
                if (authErrorMessage) authErrorMessage.textContent = err.message || 'Error de comunicación con el servidor.';
                if (authErrorAlert) authErrorAlert.classList.remove('hidden');
            } finally {
                if (btnAuthSubmit) btnAuthSubmit.disabled = false;
            }
        });
    }

    // 3. Botón de Cerrar Sesión
    const btnLogout = document.getElementById('btn-cerrar-sesion');
    if (btnLogout) {
        btnLogout.addEventListener('click', cerrarSesion);
    }

    // 4. Inicializar Flatpickr
    const dateInput = document.getElementById('fecha_vencimiento');
    if (dateInput) {
        fpInstance = flatpickr(dateInput, {
            locale: 'es',
            dateFormat: 'Y-m-d',
            altInput: true,
            altFormat: 'd \\de F, Y',
            disableMobile: true,
            theme: 'dark'
        });
    }

    // 5. Validar sesión al ingresar
    navegarAModulo('hub');
    await verificarAutenticacion();
});

