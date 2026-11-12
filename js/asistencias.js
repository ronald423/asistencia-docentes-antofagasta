
import { supabase } from "./supabase.js";

// =============================================
// MODULO DE CONTROL DE ASISTENCIAS
// U.E. TECNICO HUMANISTICO ANTOFAGASTA
// =============================================

const contenedor = document.getElementById("asistencias-content");

let registros = [];
let docentes = [];
let filtroBusqueda = "";
let filtroFecha = "";

let intervaloActualizacion = null;
let cargando = false;

// =============================================
// UTILIDADES
// =============================================

function escaparHTML(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, caracter => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[caracter]);
}

function obtenerFechaLocal() {
    const partes = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/La_Paz",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(new Date());

    const valores = {};

    partes.forEach(p => {
        valores[p.type] = p.value;
    });

    return `${valores.year}-${valores.month}-${valores.day}`;
}

function formatearFecha(fecha) {
    if (!fecha) return "-";

    const partes = fecha.split("-");

    if (partes.length !== 3) return fecha;

    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function formatearHora(fechaHora) {
    if (!fechaHora) return "-";

    return new Intl.DateTimeFormat("es-BO", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        timeZone: "America/La_Paz"
    }).format(new Date(fechaHora));
}

// =============================================
// INTERFAZ PRINCIPAL
// =============================================

function renderizarInterfaz() {

    contenedor.innerHTML = `

        <div class="asistencias-dashboard">

            <!-- ESTADISTICAS -->

            <div class="asistencias-stats">

                <div class="asistencia-stat">
                    <div class="stat-icon blue">
                        <i data-lucide="calendar-check"></i>
                    </div>
                    <div>
                        <span>Marcaciones de hoy</span>
                        <strong id="total-marcaciones">0</strong>
                    </div>
                </div>

                <div class="asistencia-stat">
                    <div class="stat-icon green">
                        <i data-lucide="log-in"></i>
                    </div>
                    <div>
                        <span>Entradas de hoy</span>
                        <strong id="total-entradas">0</strong>
                    </div>
                </div>

                <div class="asistencia-stat">
                    <div class="stat-icon orange">
                        <i data-lucide="log-out"></i>
                    </div>
                    <div>
                        <span>Salidas de hoy</span>
                        <strong id="total-salidas">0</strong>
                    </div>
                </div>

                <div class="asistencia-stat">
                    <div class="stat-icon purple">
                        <i data-lucide="users"></i>
                    </div>
                    <div>
                        <span>Docentes marcados</span>
                        <strong id="total-docentes-marcados">0</strong>
                    </div>
                </div>

            </div>

            <!-- TABLA -->

            <div class="content-card asistencias-panel">

                <div class="asistencias-toolbar">

                    <div class="asistencias-search">
                        <i data-lucide="search"></i>

                        <input
                            type="search"
                            id="buscar-asistencia"
                            placeholder="Buscar docente o CI..."
                        >
                    </div>

                    <div class="asistencias-filtros">

                        <input
                            type="date"
                            id="filtrar-fecha"
                            title="Filtrar por fecha"
                        >

                        <button
                            type="button"
                            class="btn-refresh"
                            id="actualizar-asistencias"
                        >
                            <i data-lucide="refresh-cw"></i>
                            Actualizar
                        </button>

                    </div>

                </div>

                <div id="mensaje-asistencias"
                     class="asistencias-message hidden">
                </div>

                <div class="table-responsive">

                    <table class="docentes-table asistencias-table">

                        <thead>
                            <tr>
                                <th>DOCENTE</th>
                                <th>CI</th>
                                <th>TIPO</th>
                                <th>FECHA</th>
                                <th>HORA</th>
                                <th>ESTADO</th>
                                <th>ORIGEN</th>
                            </tr>
                        </thead>

                        <tbody id="lista-asistencias">

                            <tr>
                                <td colspan="7" class="empty-state">
                                    Cargando asistencias...
                                </td>
                            </tr>

                        </tbody>

                    </table>

                </div>

                <div class="asistencias-footer">
                    <span id="cantidad-asistencias">
                        0 registros
                    </span>

                    <span id="ultima-actualizacion">
                        Esperando información...
                    </span>
                </div>

            </div>

        </div>
    `;

    if (window.lucide) {
        window.lucide.createIcons();
    }

    configurarEventos();
}

// =============================================
// CARGAR INFORMACION DE SUPABASE
// =============================================

async function cargarAsistencias() {

    if (cargando) return;

    cargando = true;

    const tbody = document.getElementById("lista-asistencias");

    if (!tbody) {
        cargando = false;
        return;
    }

    try {

        const { data: asistencias, error: errorAsistencias } =
            await supabase
                .from("asistencias")
                .select(`
                    id,
                    docente_id,
                    tipo,
                    fecha_local,
                    fecha_hora,
                    estado,
                    origen
                `)
                .order("fecha_hora", {
                    ascending: false
                })
                .limit(200);

        if (errorAsistencias) throw errorAsistencias;

        registros = asistencias || [];

        // Obtener los docentes relacionados
        const ids = [
            ...new Set(
                registros.map(r => r.docente_id).filter(Boolean)
            )
        ];

        if (ids.length > 0) {

            const { data: listaDocentes, error: errorDocentes } =
                await supabase
                    .from("docentes")
                    .select("id, ci, nombres, apellidos")
                    .in("id", ids);

            if (errorDocentes) throw errorDocentes;

            docentes = listaDocentes || [];

        } else {
            docentes = [];
        }

        // Actualizar interfaz
        actualizarEstadisticas();
        aplicarFiltros();

        document.getElementById("ultima-actualizacion").textContent =
            "Actualizado: " +
            new Intl.DateTimeFormat("es-BO", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                timeZone: "America/La_Paz"
            }).format(new Date());

    } catch (error) {

        console.error("Error cargando asistencias:", error);

        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    No se pudieron cargar las asistencias.
                </td>
            </tr>
        `;

        mostrarMensaje(
            "Error al consultar Supabase: " +
            (error.message || "Error desconocido"),
            "error"
        );

    } finally {
        cargando = false;
    }
}

// =============================================
// BUSCAR DATOS DEL DOCENTE
// =============================================

function obtenerDocente(id) {
    return docentes.find(d => d.id === id);
}

// =============================================
// ESTADISTICAS
// =============================================

function actualizarEstadisticas() {

    const hoy = obtenerFechaLocal();

    const marcacionesHoy = registros.filter(r =>
        r.fecha_local === hoy
    );

    const entradas = marcacionesHoy.filter(r =>
        r.tipo === "entrada"
    ).length;

    const salidas = marcacionesHoy.filter(r =>
        r.tipo === "salida"
    ).length;

    const docentesUnicos = new Set(
        marcacionesHoy.map(r => r.docente_id)
    );

    document.getElementById("total-marcaciones").textContent =
        marcacionesHoy.length;

    document.getElementById("total-entradas").textContent =
        entradas;

    document.getElementById("total-salidas").textContent =
        salidas;

    document.getElementById("total-docentes-marcados").textContent =
        docentesUnicos.size;
}

// =============================================
// APLICAR FILTROS
// =============================================

function aplicarFiltros() {

    const resultado = registros.filter(registro => {

        const docente = obtenerDocente(registro.docente_id);

        const nombre = docente
            ? `${docente.nombres} ${docente.apellidos}`.toLowerCase()
            : "docente desconocido";

        const ci = docente?.ci || "";

        const coincideBusqueda =
            nombre.includes(filtroBusqueda) ||
            String(ci).toLowerCase().includes(filtroBusqueda);

        const coincideFecha =
            !filtroFecha ||
            registro.fecha_local === filtroFecha;

        return coincideBusqueda && coincideFecha;
    });

    renderizarRegistros(resultado);
}

// =============================================
// MOSTRAR REGISTROS
// =============================================

function renderizarRegistros(datos) {

    const tbody = document.getElementById("lista-asistencias");

    if (!tbody) return;

    if (datos.length === 0) {

        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    No se encontraron asistencias.
                </td>
            </tr>
        `;

    } else {

        tbody.innerHTML = datos.map(registro => {

            const docente = obtenerDocente(registro.docente_id);

            const nombre = docente
                ? `${docente.apellidos}, ${docente.nombres}`
                : "Docente no encontrado";

            /* const tipo = registro.tipo || "";
 
             const esEntrada = tipo === "entrada";
 
             const estado = registro.estado || "pendiente";*/

            const tipo = registro.tipo || "";

            const esEntrada = tipo === "entrada";

            // Estado visual, sin modificar Supabase
            const estadoOriginal = registro.estado || "pendiente";

            const etiquetaEstado = esEntrada
                ? estadoOriginal
                : "Salida registrada";

            const claseEstado = !esEntrada
                ? "status-active"
                : estadoOriginal === "puntual"
                    ? "status-active"
                    : estadoOriginal === "atraso"
                        ? "status-late"
                        : "status-pending";

            return `
                <tr>

                    <td>
                        <div class="docente-name">

                            <div class="docente-avatar">
                                <i data-lucide="user-round"></i>
                            </div>

                            <strong>
                                ${escaparHTML(nombre)}
                            </strong>

                        </div>
                    </td>

                    <td>
                        ${escaparHTML(docente?.ci || "-")}
                    </td>

                    <td>
                        <span class="attendance-type ${esEntrada ? "attendance-entry" : "attendance-exit"
                }">
                            <i data-lucide="${esEntrada ? "log-in" : "log-out"}"></i>
                            ${escaparHTML(tipo)}
                        </span>
                    </td>

                    <td>
                        ${escaparHTML(
                    formatearFecha(registro.fecha_local)
                )}
                    </td>

                    <td>
                        <strong>
                            ${escaparHTML(
                    formatearHora(registro.fecha_hora)
                )}
                        </strong>
                    </td>

                    <td>
                     <span class="status-badge ${claseEstado}">
    ${escaparHTML(etiquetaEstado)}
</span>
                    </td>

                    <td>
                        ${escaparHTML(registro.origen || "online")}
                    </td>

                </tr>
            `;

        }).join("");
    }

    document.getElementById("cantidad-asistencias").textContent =
        `${datos.length} registros encontrados`;

    if (window.lucide) {
        window.lucide.createIcons();
    }
}

// =============================================
// MENSAJES
// =============================================

function mostrarMensaje(mensaje, tipo = "success") {

    const elemento = document.getElementById("mensaje-asistencias");

    if (!elemento) return;

    elemento.textContent = mensaje;
    elemento.className = `asistencias-message ${tipo}`;
    elemento.classList.remove("hidden");
}

// =============================================
// EVENTOS
// =============================================

function configurarEventos() {

    document.getElementById("buscar-asistencia")
        .addEventListener("input", event => {

            filtroBusqueda = event.target.value
                .trim()
                .toLowerCase();

            aplicarFiltros();
        });

    document.getElementById("filtrar-fecha")
        .addEventListener("change", event => {

            filtroFecha = event.target.value;

            aplicarFiltros();
        });

    document.getElementById("actualizar-asistencias")
        .addEventListener("click", cargarAsistencias);
}

// =============================================
// INICIALIZACION
// =============================================

function iniciarModuloAsistencias() {

    if (!contenedor) {
        console.error("No se encontró asistencias-content");
        return;
    }

    renderizarInterfaz();

    cargarAsistencias();

    // Actualizar cada 15 segundos
    if (intervaloActualizacion) {
        clearInterval(intervaloActualizacion);
    }

    intervaloActualizacion = setInterval(() => {

        const pagina = document.getElementById("page-asistencias");

        if (pagina?.classList.contains("active")) {
            cargarAsistencias();
        }

    }, 15000);

    // Actualizar al entrar al módulo
    document.querySelector('[data-page="asistencias"]')
        ?.addEventListener("click", cargarAsistencias);
}

iniciarModuloAsistencias();
