
import { supabase } from "./supabase.js";

// =============================================
// DASHBOARD INSTITUCIONAL
// U.E. TECNICO HUMANISTICO ANTOFAGASTA
// =============================================

let actualizando = false;
let intervaloDashboard = null;

// =============================================
// UTILIDADES
// =============================================

function escaparHTML(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[c]);
}

function obtenerFechaBolivia() {
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

    return partes.length === 3
        ? `${partes[2]}/${partes[1]}/${partes[0]}`
        : fecha;
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

function obtenerNombre(docente) {
    if (!docente) return "Docente no encontrado";

    return `${docente.nombres || ""} ${docente.apellidos || ""}`.trim();
}

// =============================================
// FECHA DEL PANEL
// =============================================

function mostrarFechaActual() {
    const elemento = document.getElementById("current-date");

    if (!elemento) return;

    elemento.textContent = new Intl.DateTimeFormat("es-BO", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "America/La_Paz"
    }).format(new Date());
}

// =============================================
// CARGAR DASHBOARD
// =============================================

async function cargarDashboard() {

    if (actualizando) return;

    actualizando = true;

    try {

        const hoy = obtenerFechaBolivia();

        // 1. TOTAL DE DOCENTES ACTIVOS
        const { count: totalDocentes, error: errorDocentes } =
            await supabase
                .from("docentes")
                .select("id", {
                    count: "exact",
                    head: true
                })
                .eq("activo", true);

        if (errorDocentes) throw errorDocentes;

        // 2. TOTAL DE TARJETAS ACTIVAS
        const { count: totalTarjetas, error: errorTarjetas } =
            await supabase
                .from("tarjetas")
                .select("id", {
                    count: "exact",
                    head: true
                })
                .eq("activa", true);

        if (errorTarjetas) throw errorTarjetas;

        // 3. ASISTENCIAS DEL DIA
        const { data: asistencias, error: errorAsistencias } =
            await supabase
                .from("asistencias")
                .select(`
                    id,
                    docente_id,
                    tipo,
                    fecha_local,
                    fecha_hora,
                    estado
                `)
                .eq("fecha_local", hoy)
                .order("fecha_hora", {
                    ascending: false
                });

        if (errorAsistencias) throw errorAsistencias;

        const registros = asistencias || [];

        // 4. CONTAR ATRASOS
        const totalAtrasos = registros.filter(r =>
            r.estado === "atraso" &&
            r.tipo === "entrada"
        ).length;

        // 5. ACTUALIZAR INDICADORES
        document.getElementById("stat-docentes").textContent =
            totalDocentes ?? 0;

        document.getElementById("stat-asistencias").textContent =
            registros.length;

        document.getElementById("stat-atrasos").textContent =
            totalAtrasos;

        document.getElementById("stat-tarjetas").textContent =
            totalTarjetas ?? 0;

        // 6. BUSCAR LOS DOCENTES DE LAS ULTIMAS MARCACIONES
        const ultimas = registros.slice(0, 8);

        const idsDocentes = [
            ...new Set(ultimas.map(r => r.docente_id).filter(Boolean))
        ];

        let docentes = [];

        if (idsDocentes.length > 0) {

            const { data, error } = await supabase
                .from("docentes")
                .select("id, nombres, apellidos")
                .in("id", idsDocentes);

            if (error) throw error;

            docentes = data || [];
        }

        // 7. MOSTRAR ULTIMAS MARCACIONES
        renderizarMarcaciones(ultimas, docentes);

        console.log("Dashboard actualizado:", {
            docentes: totalDocentes,
            asistencias: registros.length,
            atrasos: totalAtrasos,
            tarjetas: totalTarjetas
        });

    } catch (error) {

        console.error("Error actualizando Dashboard:", error);

        const tbody = document.getElementById(
            "dashboard-attendance"
        );

        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-state">
                        No se pudieron cargar los datos.
                        Revise la conexión con Supabase.
                    </td>
                </tr>
            `;
        }

    } finally {
        actualizando = false;
    }
}

// =============================================
// RENDERIZAR ULTIMAS MARCACIONES
// =============================================

function renderizarMarcaciones(registros, docentes) {

    const tbody = document.getElementById(
        "dashboard-attendance"
    );

    if (!tbody) return;

    if (registros.length === 0) {

        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">
                    No hay marcaciones registradas hoy.
                </td>
            </tr>
        `;

        return;
    }

    tbody.innerHTML = registros.map(registro => {

        const docente = docentes.find(
            d => d.id === registro.docente_id
        );

        const nombre = obtenerNombre(docente);

        const entrada = registro.tipo === "entrada";

        const tipoHTML = entrada
            ? `<span class="attendance-type attendance-entry">
                    Entrada
               </span>`
            : `<span class="attendance-type attendance-exit">
                    Salida
               </span>`;

        const estadoOriginal = registro.estado || "pendiente";

        const etiquetaEstado = registro.tipo === "salida"
            ? "Salida registrada"
            : estadoOriginal;

        const claseEstado = registro.tipo === "salida"
            ? "status-active"
            : estadoOriginal === "puntual"
                ? "status-active"
                : estadoOriginal === "atraso"
                    ? "status-late"
                    : "status-pending";

        return `
            <tr>

                <td>
                    <strong>${escaparHTML(nombre)}</strong>
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

                <td>${tipoHTML}</td>

                <td>
                    <span class="status-badge ${claseEstado}">
    ${escaparHTML(etiquetaEstado)}
</span>
                </td>

            </tr>
        `;

    }).join("");
}

// =============================================
// INICIALIZACION
// =============================================

function iniciarDashboard() {

    mostrarFechaActual();

    cargarDashboard();

    if (intervaloDashboard) {
        clearInterval(intervaloDashboard);
    }

    intervaloDashboard = setInterval(() => {

        const pagina = document.getElementById("page-dashboard");

        if (pagina?.classList.contains("active")) {
            mostrarFechaActual();
            cargarDashboard();
        }

    }, 15000);

    // Actualizar al ingresar al Dashboard
    document.querySelector('[data-page="dashboard"]')
        ?.addEventListener("click", () => {
            mostrarFechaActual();
            cargarDashboard();
        });
}

iniciarDashboard();
