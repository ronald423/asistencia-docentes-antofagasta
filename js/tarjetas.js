
import { supabase } from "./supabase.js";

// =============================================
// MODULO DE TARJETAS RFID
// U.E. TECNICO HUMANISTICO ANTOFAGASTA
// =============================================

const contenedor = document.getElementById("tarjetas-content");

const DEVICE_ID =
    "ab449e01-edec-48a5-b01f-6d863d15b6da";

let docentes = [];
let tarjetas = [];
let solicitudActiva = null;
let intervaloSolicitud = null;
let procesando = false;

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

function nombreDocente(docente) {
    return `${docente?.nombres || ""} ${docente?.apellidos || ""}`.trim();
}

function buscarDocente(id) {
    return docentes.find(d => d.id === id);
}

function mostrarMensaje(texto, tipo = "success") {
    const elemento = document.getElementById("mensaje-tarjetas");

    if (!elemento) return;

    elemento.textContent = texto;
    elemento.className = `tarjetas-message ${tipo}`;
    elemento.classList.remove("hidden");
}

// =============================================
// INTERFAZ
// =============================================

function renderizarInterfaz() {

    contenedor.innerHTML = `

        <div class="tarjetas-dashboard">

            <div class="tarjetas-resumen">

                <div class="tarjeta-stat">
                    <span>Tarjetas registradas</span>
                    <strong id="total-tarjetas">0</strong>
                </div>

                <div class="tarjeta-stat">
                    <span>Tarjetas activas</span>
                    <strong id="tarjetas-activas">0</strong>
                </div>

                <div class="tarjeta-stat">
                    <span>Docentes activos</span>
                    <strong id="docentes-tarjetas">0</strong>
                </div>

            </div>

            <div class="content-card tarjeta-asignacion-card">

                <div class="tarjeta-heading">
                    <div>
                        <h2>Asignar tarjeta RFID</h2>
                        <p>
                            Seleccione un docente y solicite la lectura
                            de su tarjeta en el dispositivo RFID.
                        </p>
                    </div>
                </div>

                <form id="form-asignar-tarjeta">

                    <div class="tarjeta-form-grid">

                        <div class="form-group">
                            <label for="seleccionar-docente">
                                Seleccionar docente
                            </label>

                            <select
                                id="seleccionar-docente"
                                required
                            >
                                <option value="">
                                    Seleccionar docente
                                </option>
                            </select>
                        </div>

                        <div class="tarjeta-dispositivo">
                            <i data-lucide="radio-tower"></i>

                            <div>
                                <strong>RFID Antofagasta 01</strong>
                                <span>NodeMCU ESP8266 · RC522</span>
                            </div>

                            <span class="device-indicator"></span>
                        </div>

                    </div>

                    <div id="mensaje-tarjetas"
                         class="tarjetas-message hidden">
                    </div>

                    <div class="tarjeta-form-actions">

                        <button
                            type="submit"
                            id="solicitar-lectura"
                            class="btn-save"
                        >
                            <i data-lucide="radio"></i>
                            Solicitar lectura RFID
                        </button>

                    </div>

                </form>

                <div id="estado-enrolamiento"
                     class="enrolamiento-panel hidden">

                    <div class="enrolamiento-icon">
                        <i data-lucide="credit-card"></i>
                    </div>

                    <div>
                        <strong id="enrolamiento-titulo">
                            Esperando tarjeta
                        </strong>

                        <p id="enrolamiento-descripcion">
                            Acerque la tarjeta al lector RC522.
                        </p>

                        <span id="enrolamiento-cuenta"></span>
                    </div>

                    <button
                        type="button"
                        id="cancelar-enrolamiento"
                        class="btn-cancel"
                    >
                        Cancelar
                    </button>

                </div>

            </div>

            <div class="content-card tarjetas-list-card">

                <div class="tarjeta-heading">
                    <div>
                        <h2>Tarjetas registradas</h2>
                        <p>
                            Administración de tarjetas asignadas
                            a los docentes.
                        </p>
                    </div>

                    <button
                        type="button"
                        id="actualizar-tarjetas"
                        class="btn-refresh"
                    >
                        <i data-lucide="refresh-cw"></i>
                        Actualizar
                    </button>
                </div>

                <div class="tarjeta-busqueda">
                    <i data-lucide="search"></i>

                    <input
                        type="search"
                        id="buscar-tarjeta"
                        placeholder="Buscar por docente, CI o UID..."
                    >
                </div>

                <div class="table-responsive">

                    <table class="docentes-table">

                        <thead>
                            <tr>
                                <th>DOCENTE</th>
                                <th>CI</th>
                                <th>UID RFID</th>
                                <th>ESTADO</th>
                                <th>ACCIONES</th>
                            </tr>
                        </thead>

                        <tbody id="lista-tarjetas">
                            <tr>
                                <td colspan="5" class="empty-state">
                                    Cargando tarjetas...
                                </td>
                            </tr>
                        </tbody>

                    </table>

                </div>

                <div class="tarjetas-footer">
                    <span id="cantidad-tarjetas">
                        0 tarjetas encontradas
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
// CARGAR DOCENTES
// =============================================

async function cargarDocentes() {

    const { data, error } = await supabase
        .from("docentes")
        .select("id, nombres, apellidos, ci")
        .eq("activo", true)
        .order("apellidos");

    if (error) throw error;

    docentes = data || [];

    const select = document.getElementById("seleccionar-docente");

    select.innerHTML = `
        <option value="">Seleccionar docente</option>

        ${docentes.map(d => `
            <option value="${escaparHTML(d.id)}">
                ${escaparHTML(nombreDocente(d))}
                - CI: ${escaparHTML(d.ci)}
            </option>
        `).join("")}
    `;

    document.getElementById("docentes-tarjetas").textContent =
        docentes.length;
}

// =============================================
// CARGAR TARJETAS
// =============================================

async function cargarTarjetas() {

    const tbody = document.getElementById("lista-tarjetas");

    try {

        const { data, error } = await supabase
            .from("tarjetas")
            .select(`
                id,
                docente_id,
                uid,
                activa
            `)
            .order("uid");

        if (error) throw error;

        tarjetas = data || [];

        actualizarResumen();
        renderizarTarjetas();

    } catch (error) {

        console.error("Error cargando tarjetas:", error);

        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">
                    No se pudieron cargar las tarjetas.
                </td>
            </tr>
        `;

        mostrarMensaje(error.message, "error");
    }
}

// =============================================
// RESUMEN
// =============================================

function actualizarResumen() {

    document.getElementById("total-tarjetas").textContent =
        tarjetas.length;

    document.getElementById("tarjetas-activas").textContent =
        tarjetas.filter(t => t.activa).length;
}

// =============================================
// MOSTRAR TABLA
// =============================================

function renderizarTarjetas() {

    const tbody = document.getElementById("lista-tarjetas");

    const busqueda = (
        document.getElementById("buscar-tarjeta")?.value || ""
    ).trim().toLowerCase();

    const filtradas = tarjetas.filter(t => {

        const docente = buscarDocente(t.docente_id);

        const nombre = nombreDocente(docente).toLowerCase();
        const ci = String(docente?.ci || "").toLowerCase();
        const uid = String(t.uid || "").toLowerCase();

        return nombre.includes(busqueda) ||
            ci.includes(busqueda) ||
            uid.includes(busqueda);
    });

    if (!filtradas.length) {

        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">
                    No se encontraron tarjetas registradas.
                </td>
            </tr>
        `;

    } else {

        tbody.innerHTML = filtradas.map(t => {

            const docente = buscarDocente(t.docente_id);

            return `
                <tr>

                    <td>
                        <strong>
                            ${escaparHTML(
                docente
                    ? `${docente.apellidos}, ${docente.nombres}`
                    : "Docente no encontrado"
            )}
                        </strong>
                    </td>

                    <td>${escaparHTML(docente?.ci || "-")}</td>

                    <td>
                        <code class="uid-code">
                            ${escaparHTML(t.uid)}
                        </code>
                    </td>

                    <td>
                        <span class="status-badge ${t.activa ? "status-active" : "status-inactive"
                }">
                            ${t.activa ? "Activa" : "Inactiva"}
                        </span>
                    </td>

                    <td>
                        <button
    type="button"
    class="action-btn ${t.activa ? "deactivate-btn" : "activate-btn"}"
    data-action="cambiar-estado"
    data-id="${escaparHTML(t.id)}"
    title="${t.activa ? "Desactivar tarjeta" : "Activar tarjeta"}"
>
    <i data-lucide="${t.activa ? "credit-card" : "check-circle"}"></i>
</button>
                    </td>

                </tr>
            `;

        }).join("");
    }

    document.getElementById("cantidad-tarjetas").textContent =
        `${filtradas.length} tarjetas encontradas`;

    if (window.lucide) window.lucide.createIcons();
}

// =============================================
// CREAR SOLICITUD DE ENROLAMIENTO
// =============================================

async function solicitarLectura(event) {

    event.preventDefault();

    if (procesando || solicitudActiva) return;

    const docenteId =
        document.getElementById("seleccionar-docente").value;

    if (!docenteId) {
        mostrarMensaje("Seleccione un docente.", "error");
        return;
    }

    const docente = buscarDocente(docenteId);

    if (!docente) {
        mostrarMensaje("No se encontró el docente.", "error");
        return;
    }

    const tarjetaExistente = tarjetas.find(t =>
        t.docente_id === docenteId && t.activa
    );

    if (tarjetaExistente) {
        mostrarMensaje(
            "Este docente ya tiene una tarjeta activa. " +
            "Desactive la anterior antes de asignar otra.",
            "error"
        );
        return;
    }

    procesando = true;

    const boton = document.getElementById("solicitar-lectura");

    boton.disabled = true;
    boton.textContent = "Preparando solicitud...";

    try {

        const { data: usuarioResult, error: errorUsuario } =
            await supabase.auth.getUser();

        if (errorUsuario) throw errorUsuario;

        const usuario = usuarioResult.user;

        if (!usuario) {
            throw new Error("La sesión administrativa no está disponible.");
        }

        // Verificar si hay otra solicitud pendiente
        const { data: pendientes, error: errorPendientes } =
            await supabase
                .from("solicitudes_enrolamiento")
                .select("id")
                .eq("estado", "pendiente")
                .gt("expira_at", new Date().toISOString())
                .limit(1);

        if (errorPendientes) throw errorPendientes;

        if (pendientes?.length) {
            throw new Error(
                "Ya existe una solicitud de lectura pendiente."
            );
        }

        const expira = new Date(
            Date.now() + 2 * 60 * 1000
        ).toISOString();

        const { data, error } = await supabase
            .from("solicitudes_enrolamiento")
            .insert({
                docente_id: docenteId,
                dispositivo_id: DEVICE_ID,
                solicitado_por: usuario.id,
                estado: "pendiente",
                expira_at: expira
            })
            .select("id, docente_id, estado, expira_at")
            .single();

        if (error) throw error;

        solicitudActiva = data;

        mostrarPanelEnrolamiento(docente);

        // Consultar el resultado de la solicitud
        iniciarSeguimientoSolicitud();

    } catch (error) {

        console.error("Error solicitando enrolamiento:", error);

        mostrarMensaje(
            error.message || "No se pudo solicitar la lectura.",
            "error"
        );

    } finally {

        procesando = false;

        boton.disabled = false;

        boton.innerHTML = `
            <i data-lucide="radio"></i>
            Solicitar lectura RFID
        `;

        if (window.lucide) window.lucide.createIcons();
    }
}

// =============================================
// MOSTRAR SOLICITUD ACTIVA
// =============================================

function mostrarPanelEnrolamiento(docente) {

    const panel = document.getElementById("estado-enrolamiento");

    panel.classList.remove("hidden");

    document.getElementById("enrolamiento-titulo").textContent =
        `Esperando tarjeta de ${nombreDocente(docente)}`;

    document.getElementById("enrolamiento-descripcion").textContent =
        "La solicitud está creada. Acerque la tarjeta al lector RFID.";

    document.getElementById("enrolamiento-cuenta").textContent =
        "Tiempo límite: 2 minutos";

    if (window.lucide) window.lucide.createIcons();
}

// =============================================
// SEGUIMIENTO DE SOLICITUD
// =============================================

function iniciarSeguimientoSolicitud() {

    detenerSeguimientoSolicitud();

    intervaloSolicitud = setInterval(
        comprobarSolicitud,
        3000
    );

    comprobarSolicitud();
}

function detenerSeguimientoSolicitud() {

    if (intervaloSolicitud) {
        clearInterval(intervaloSolicitud);
        intervaloSolicitud = null;
    }
}

async function comprobarSolicitud() {

    if (!solicitudActiva) return;

    try {

        const { data, error } = await supabase
            .from("solicitudes_enrolamiento")
            .select(`
                id,
                docente_id,
                uid_leido,
                estado,
                expira_at
            `)
            .eq("id", solicitudActiva.id)
            .single();

        if (error) throw error;

        // Verificar vencimiento
        if (new Date(data.expira_at) <= new Date()) {

            detenerSeguimientoSolicitud();

            solicitudActiva = null;

            document.getElementById("estado-enrolamiento")
                .classList.add("hidden");

            mostrarMensaje(
                "La solicitud expiró. Puede solicitar otra lectura.",
                "error"
            );

            return;
        }

        // Esperar a que el dispositivo informe el UID
        if (data.uid_leido) {
            detenerSeguimientoSolicitud();
            await asignarTarjetaRecibida(data);
        }

    } catch (error) {

        console.error("Error consultando enrolamiento:", error);
    }
}

// =============================================
// ASIGNAR UID RECIBIDO
// =============================================

async function asignarTarjetaRecibida(solicitud) {

    if (procesando) return;

    procesando = true;

    try {

        const uid = String(solicitud.uid_leido)
            .trim()
            .toUpperCase();

        if (!/^[0-9A-F]{8,32}$/.test(uid)) {
            throw new Error("El UID recibido no tiene un formato válido.");
        }

        // Comprobar si el UID ya está asignado a otra tarjeta
        const { data: existente, error: errorBusqueda } =
            await supabase
                .from("tarjetas")
                .select("id, docente_id, activa")
                .eq("uid", uid)
                .limit(1);

        if (errorBusqueda) throw errorBusqueda;

        if (existente?.length) {
            throw new Error(
                "Esta tarjeta ya está registrada. No se puede duplicar."
            );
        }

        // Guardar tarjeta
        const { error: errorInsert } = await supabase
            .from("tarjetas")
            .insert({
                docente_id: solicitud.docente_id,
                uid: uid,
                activa: true
            });

        if (errorInsert) throw errorInsert;

        // Marcar solicitud como asignada
        const { error: errorUpdate } = await supabase
            .from("solicitudes_enrolamiento")
            .update({
                estado: "asignada",
                asignado_at: new Date().toISOString()
            })
            .eq("id", solicitud.id);

        if (errorUpdate) {
            console.error("No se pudo actualizar la solicitud:", errorUpdate);
        }

        const docente = buscarDocente(solicitud.docente_id);

        document.getElementById("estado-enrolamiento")
            .classList.add("hidden");

        mostrarMensaje(
            `Tarjeta ${uid} asignada correctamente a ${nombreDocente(docente)}.`,
            "success"
        );

        solicitudActiva = null;

        await cargarTarjetas();

    } catch (error) {

        console.error("Error asignando tarjeta:", error);

        mostrarMensaje(
            error.message || "No se pudo asignar la tarjeta.",
            "error"
        );

        document.getElementById("enrolamiento-titulo").textContent =
            "No se pudo completar la asignación";

        document.getElementById("enrolamiento-descripcion").textContent =
            error.message;

    } finally {
        procesando = false;
    }
}

// =============================================
// CANCELAR SOLICITUD
// =============================================

async function cancelarEnrolamiento() {

    if (!solicitudActiva) return;

    const confirmar = confirm(
        "¿Desea cancelar la solicitud de lectura RFID?"
    );

    if (!confirmar) return;

    detenerSeguimientoSolicitud();

    try {

        const { error } = await supabase
            .from("solicitudes_enrolamiento")
            .update({
                estado: "cancelada"
            })
            .eq("id", solicitudActiva.id);

        if (error) throw error;

        solicitudActiva = null;

        document.getElementById("estado-enrolamiento")
            .classList.add("hidden");

        mostrarMensaje(
            "Solicitud cancelada.",
            "success"
        );

    } catch (error) {

        mostrarMensaje(
            error.message || "No se pudo cancelar la solicitud.",
            "error"
        );
    }
}

// =============================================
// DESACTIVAR TARJETA
// =============================================

/*async function desactivarTarjeta(id) {

    const confirmar = confirm(
        "¿Está seguro de desactivar esta tarjeta RFID?"
    );

    if (!confirmar) return;

    try {

        const { error } = await supabase
            .from("tarjetas")
            .update({
                activa: false
            })
            .eq("id", id);

        if (error) throw error;

        mostrarMensaje(
            "Tarjeta desactivada correctamente.",
            "success"
        );

        await cargarTarjetas();

    } catch (error) {

        console.error(error);

        mostrarMensaje(
            error.message || "No se pudo desactivar la tarjeta.",
            "error"
        );
    }
}*/


async function cambiarEstadoTarjeta(id) {

    const tarjeta = tarjetas.find(t => t.id === id);

    if (!tarjeta) return;

    const nuevoEstado = !tarjeta.activa;

    const accion = nuevoEstado ? "activar" : "desactivar";

    const confirmar = confirm(
        `¿Está seguro de ${accion} esta tarjeta RFID?`
    );

    if (!confirmar) return;

    try {

        const { error } = await supabase
            .from("tarjetas")
            .update({
                activa: nuevoEstado
            })
            .eq("id", id);

        if (error) throw error;

        mostrarMensaje(
            `Tarjeta ${nuevoEstado ? "activada" : "desactivada"} correctamente.`,
            "success"
        );

        await cargarTarjetas();

    } catch (error) {

        console.error("Error cambiando estado:", error);

        mostrarMensaje(
            error.message || "No se pudo cambiar el estado.",
            "error"
        );
    }
}


// =============================================
// CARGA GENERAL
// =============================================

async function cargarDatos() {

    try {

        const { data, error } = await supabase
            .from("docentes")
            .select("id, nombres, apellidos, ci")
            .eq("activo", true)
            .order("apellidos");

        if (error) throw error;

        docentes = data || [];

        document.getElementById("docentes-tarjetas").textContent =
            docentes.length;

        const select = document.getElementById("seleccionar-docente");

        select.innerHTML = `
            <option value="">Seleccionar docente</option>
            ${docentes.map(d => `
                <option value="${escaparHTML(d.id)}">
                    ${escaparHTML(nombreDocente(d))}
                    - CI: ${escaparHTML(d.ci)}
                </option>
            `).join("")}
        `;

        await cargarTarjetas();

    } catch (error) {

        console.error("Error inicializando tarjetas:", error);

        mostrarMensaje(
            error.message || "No se pudieron cargar los datos.",
            "error"
        );
    }
}

// =============================================
// EVENTOS
// =============================================

function configurarEventos() {

    document.getElementById("form-asignar-tarjeta")
        .addEventListener("submit", solicitarLectura);

    document.getElementById("cancelar-enrolamiento")
        .addEventListener("click", cancelarEnrolamiento);

    document.getElementById("actualizar-tarjetas")
        .addEventListener("click", cargarDatos);

    document.getElementById("buscar-tarjeta")
        .addEventListener("input", renderizarTarjetas);

    document.getElementById("lista-tarjetas")
        .addEventListener("click", event => {

            const boton = event.target.closest("[data-action]");

            if (!boton) return;

            if (boton.dataset.action === "cambiar-estado") {
    cambiarEstadoTarjeta(boton.dataset.id);
}
        });
}

// =============================================
// INICIALIZACION
// =============================================

function iniciarModuloTarjetas() {

    if (!contenedor) {
        console.error("No se encontró tarjetas-content");
        return;
    }

    renderizarInterfaz();

    cargarDatos();

    document.querySelector('[data-page="tarjetas"]')
        ?.addEventListener("click", cargarDatos);
}

iniciarModuloTarjetas();
