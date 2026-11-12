
import { supabase } from "./supabase.js";

// =============================================
// MANTENIMIENTO DEL SISTEMA
// U.E. TECNICO HUMANISTICO ANTOFAGASTA
// =============================================

const contenedor = document.getElementById(
    "mantenimiento-content"
);

const FRASE_CONFIRMACION = "LIMPIAR DATOS DE PRUEBA";

let ejecutando = false;


function escaparHTML(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[c]);
}


// =============================================
// INTERFAZ
// =============================================

function renderizarInterfaz() {

    contenedor.innerHTML = `

        <div class="content-card mantenimiento-card">

            <div class="mantenimiento-heading">
                <div class="mantenimiento-icon">
                    <i data-lucide="database-backup"></i>
                </div>

                <div>
                    <h2>Limpieza general de datos de prueba</h2>
                    <p>
                        Libere las tarjetas RFID y elimine las
                        marcaciones utilizadas durante las pruebas.
                    </p>
                </div>
            </div>

            <div class="mantenimiento-resumen">

                <div class="mantenimiento-item">
                    <span>Asistencias registradas</span>
                    <strong id="m-total-asistencias">--</strong>
                </div>

                <div class="mantenimiento-item">
                    <span>Tarjetas asignadas</span>
                    <strong id="m-total-tarjetas">--</strong>
                </div>

                <div class="mantenimiento-item">
                    <span>Solicitudes pendientes o recibidas</span>
                    <strong id="m-total-solicitudes">--</strong>
                </div>

            </div>

            <div class="mantenimiento-conservacion">

                <h3>
                    <i data-lucide="shield-check"></i>
                    Información que se conservará
                </h3>

                <div class="conservacion-grid">
                    <span>Docentes</span>
                    <span>Horarios institucionales</span>
                    <span>Administradores</span>
                    <span>Dispositivo NodeMCU</span>
                    <span>Configuración del sistema</span>
                </div>

            </div>

            <div class="mantenimiento-advertencia">

                <i data-lucide="alert-triangle"></i>

                <div>
                    <strong>Operación irreversible</strong>

                    <p>
                        Se eliminarán todas las asistencias y las
                        asignaciones de tarjetas. Las tarjetas físicas
                        podrán volver a asignarse posteriormente.
                    </p>
                </div>

            </div>


<div class="mantenimiento-selectivo">

    <h3>Limpieza individual de asistencias</h3>

    <p>
        Seleccione un docente para eliminar únicamente
        sus marcaciones del día actual.
    </p>

    <label for="docente-limpieza">
        Seleccionar docente
    </label>

    <select id="docente-limpieza">
        <option value="">Cargando docentes...</option>
    </select>

    <div class="mantenimiento-item">
        <span>Asistencias de hoy del docente</span>
        <strong id="asistencias-docente-hoy">--</strong>
    </div>

    <button
        type="button"
        id="btn-limpiar-docente"
        class="btn-limpiar"
        disabled
    >
        <i data-lucide="calendar-x"></i>
        Eliminar asistencias de hoy
    </button>

    <div
        id="mensaje-limpieza-selectiva"
        class="mantenimiento-mensaje hidden">
    </div>

</div>




            <div class="mantenimiento-confirmacion">

                <label for="confirmacion-limpieza">
                    Para habilitar la limpieza, escriba exactamente:
                    <strong>${FRASE_CONFIRMACION}</strong>
                </label>

                <input
                    type="text"
                    id="confirmacion-limpieza"
                    placeholder="Escriba la frase de confirmación"
                    autocomplete="off"
                >

                <button
                    type="button"
                    id="btn-limpiar-datos"
                    class="btn-limpiar"
                    disabled
                >
                    <i data-lucide="trash-2"></i>
                    Limpiar datos de prueba
                </button>

            </div>

            <div
                id="mensaje-mantenimiento"
                class="mantenimiento-mensaje hidden">
            </div>

            <div
                id="resultado-mantenimiento"
                class="resultado-mantenimiento hidden">
            </div>

        </div>
    `;

    if (window.lucide) {
        window.lucide.createIcons();
    }

    configurarEventos();
}

// =============================================
// CONSULTAR CANTIDADES
// =============================================

async function cargarResumen() {

    try {

        const [
            asistencias,
            tarjetas,
            solicitudes
        ] = await Promise.all([

            supabase
                .from("asistencias")
                .select("id", {
                    count: "exact",
                    head: true
                }),

            supabase
                .from("tarjetas")
                .select("id", {
                    count: "exact",
                    head: true
                }),

            supabase
                .from("solicitudes_enrolamiento")
                .select("id", {
                    count: "exact",
                    head: true
                })
                .in("estado", ["pendiente", "recibida"])

        ]);

        if (asistencias.error) throw asistencias.error;
        if (tarjetas.error) throw tarjetas.error;
        if (solicitudes.error) throw solicitudes.error;

        document.getElementById(
            "m-total-asistencias"
        ).textContent = asistencias.count ?? 0;

        document.getElementById(
            "m-total-tarjetas"
        ).textContent = tarjetas.count ?? 0;

        document.getElementById(
            "m-total-solicitudes"
        ).textContent = solicitudes.count ?? 0;

    } catch (error) {

        console.error("Error consultando mantenimiento:", error);

        mostrarMensaje(
            "No se pudo consultar el resumen: " + error.message,
            "error"
        );
    }
}

// =============================================
// MENSAJES
// =============================================

function mostrarMensaje(texto, tipo) {

    const elemento = document.getElementById(
        "mensaje-mantenimiento"
    );

    elemento.textContent = texto;
    elemento.className =
        `mantenimiento-mensaje ${tipo}`;
}

// =============================================
// EJECUTAR LIMPIEZA
// =============================================

async function limpiarDatos() {

    if (ejecutando) return;

    const entrada = document.getElementById(
        "confirmacion-limpieza"
    );

    if (entrada.value !== FRASE_CONFIRMACION) {
        mostrarMensaje(
            "La frase de confirmación no es correcta.",
            "error"
        );
        return;
    }

    const confirmar = confirm(
        "ATENCIÓN: Se eliminarán TODAS las asistencias " +
        "y TODAS las asignaciones de tarjetas RFID.\n\n" +
        "Los docentes y horarios se conservarán.\n\n" +
        "¿Está completamente seguro?"
    );

    if (!confirmar) return;

    ejecutando = true;

    const boton = document.getElementById(
        "btn-limpiar-datos"
    );

    boton.disabled = true;
    boton.textContent = "Ejecutando limpieza...";

    try {

        const { data, error } = await supabase.rpc(
            "limpiar_datos_prueba"
        );

        if (error) throw error;

        if (!data?.ok) {
            throw new Error(
                data?.mensaje || "La limpieza no fue confirmada."
            );
        }

        mostrarMensaje(
            "La limpieza de datos de prueba se completó correctamente.",
            "success"
        );

        document.getElementById(
            "resultado-mantenimiento"
        ).innerHTML = `

            <h3>
                <i data-lucide="check-circle"></i>
                Limpieza completada
            </h3>

            <div class="resultado-grid">

                <div>
                    <strong>${Number(data.asistencias_eliminadas) || 0}</strong>
                    <span>Asistencias eliminadas</span>
                </div>

                <div>
                    <strong>${Number(data.tarjetas_liberadas) || 0}</strong>
                    <span>Tarjetas liberadas</span>
                </div>

                <div>
                    <strong>${Number(data.solicitudes_canceladas) || 0}</strong>
                    <span>Solicitudes canceladas</span>
                </div>

            </div>
        `;

        document.getElementById(
            "resultado-mantenimiento"
        ).classList.remove("hidden");

        entrada.value = "";

        await cargarResumen();

        // Actualizar los módulos que ya están abiertos
        window.dispatchEvent(
            new CustomEvent("datos-prueba-limpiados")
        );

    } catch (error) {

        console.error("Error en limpieza:", error);

        mostrarMensaje(
            "No se pudo completar la limpieza: " +
            error.message,
            "error"
        );

    } finally {

        ejecutando = false;

        boton.innerHTML = `
            <i data-lucide="trash-2"></i>
            Limpiar datos de prueba
        `;

        boton.disabled = true;

        if (window.lucide) {
            window.lucide.createIcons();
        }
    }
}

// =============================================
// EVENTOS
// =============================================

/*function configurarEventos() {

    const entrada = document.getElementById(
        "confirmacion-limpieza"
    );

    const boton = document.getElementById(
        "btn-limpiar-datos"
    );

    entrada.addEventListener("input", () => {

        boton.disabled =
            entrada.value !== FRASE_CONFIRMACION ||
            ejecutando;
    });

    boton.addEventListener("click", limpiarDatos);

}*/

function configurarEventos() {

    const entrada = document.getElementById(
        "confirmacion-limpieza"
    );

    const boton = document.getElementById(
        "btn-limpiar-datos"
    );

    entrada.addEventListener("input", () => {

        boton.disabled =
            entrada.value !== FRASE_CONFIRMACION ||
            ejecutando;
    });

    boton.addEventListener("click", limpiarDatos);

    // Configurar eventos de limpieza selectiva
    configurarLimpiezaSelectiva();

}


// =============================================
// INICIALIZACION
// =============================================

function iniciarMantenimiento() {

    if (!contenedor) {
        console.error("No se encontró mantenimiento-content");
        return;
    }

    renderizarInterfaz();

    cargarResumen();

    document.querySelector('[data-page="mantenimiento"]')
        ?.addEventListener("click", cargarResumen);
}


// =============================================
// LIMPIEZA SELECTIVA POR DOCENTE
// =============================================

/*async function cargarDocentesLimpieza() {

    const select = document.getElementById("docente-limpieza");

    const { data, error } = await supabase
        .from("docentes")
        .select("id, nombres, apellidos, ci")
        .eq("activo", true)
        .order("apellidos");

    if (error) {
        console.error(error);
        return;
    }

    select.innerHTML = `
        <option value="">Seleccione un docente</option>
        ${(data || []).map(d => `
            <option value="${d.id}">
                ${escaparHTML(d.apellidos + ", " + d.nombres)}
                - CI: ${escaparHTML(d.ci)}
            </option>
        `).join("")}
    `;
}*/


async function cargarDocentesLimpieza() {

    const select = document.getElementById("docente-limpieza");

    if (!select) {
        console.error("No existe el selector docente-limpieza");
        return;
    }

    select.innerHTML = `
        <option value="">Consultando docentes...</option>
    `;

    try {

        console.log("Consultando docentes para mantenimiento...");

        const { data, error } = await supabase
            .from("docentes")
            .select("id, nombres, apellidos, ci, activo")
            .eq("activo", true)
            .order("apellidos", { ascending: true });

        if (error) {
            throw error;
        }

        console.log("Docentes encontrados:", data);

        if (!data || data.length === 0) {

            select.innerHTML = `
                <option value="">No hay docentes activos</option>
            `;

            return;
        }

        select.innerHTML = `
            <option value="">Seleccione un docente</option>

            ${data.map(d => `
                <option value="${escaparHTML(d.id)}">
                    ${escaparHTML(d.apellidos)}, 
                    ${escaparHTML(d.nombres)}
                    - CI: ${escaparHTML(d.ci)}
                </option>
            `).join("")}
        `;

    } catch (error) {

        console.error("ERROR CARGANDO DOCENTES:", error);

        select.innerHTML = `
            <option value="">Error al cargar docentes</option>
        `;

        mostrarMensaje(
            "No se pudieron cargar los docentes: " + error.message,
            "error"
        );
    }
}

async function consultarAsistenciasDocenteHoy() {

    const docenteId =
        document.getElementById("docente-limpieza").value;

    const boton =
        document.getElementById("btn-limpiar-docente");

    const contador =
        document.getElementById("asistencias-docente-hoy");

    boton.disabled = true;
    contador.textContent = "--";

    if (!docenteId) return;

    const partes = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/La_Paz",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(new Date());

    const fecha = Object.fromEntries(
        partes.map(p => [p.type, p.value])
    );

    const hoy = `${fecha.year}-${fecha.month}-${fecha.day}`;

    const { count, error } = await supabase
        .from("asistencias")
        .select("id", {
            count: "exact",
            head: true
        })
        .eq("docente_id", docenteId)
        .eq("fecha_local", hoy);

    if (error) {
        mostrarMensaje(
            "No se pudieron consultar las asistencias.",
            "error"
        );
        return;
    }

    contador.textContent = count ?? 0;
    boton.disabled = (count ?? 0) === 0;
}

async function limpiarAsistenciasDocenteHoy() {

    const docenteId =
        document.getElementById("docente-limpieza").value;

    if (!docenteId) return;

    const cantidad = Number(
        document.getElementById("asistencias-docente-hoy").textContent
    );

    if (cantidad <= 0) return;

    const docenteSelect =
        document.getElementById("docente-limpieza");

    const nombre =
        docenteSelect.options[docenteSelect.selectedIndex].text;

    const confirmar = confirm(
        `¿Eliminar las ${cantidad} asistencias de hoy de ${nombre}?\n\n` +
        "Se conservarán sus tarjetas, docente, horarios " +
        "y asistencias de días anteriores."
    );

    if (!confirmar) return;

    const boton =
        document.getElementById("btn-limpiar-docente");

    boton.disabled = true;
    boton.textContent = "Eliminando...";

    try {

        const { data, error } = await supabase.rpc(
            "limpiar_asistencias_docente_hoy",
            {
                p_docente_id: docenteId
            }
        );

        if (error) throw error;

        if (!data?.ok) {
            throw new Error("La limpieza no fue confirmada.");
        }

        const mensaje = document.getElementById(
            "mensaje-limpieza-selectiva"
        );

        mensaje.textContent =
            `Se eliminaron ${data.asistencias_eliminadas} ` +
            "asistencias de hoy. La tarjeta RFID permanece asignada.";

        mensaje.className =
            "mantenimiento-mensaje success";

        await consultarAsistenciasDocenteHoy();
        await cargarResumen();

        window.dispatchEvent(
            new CustomEvent("datos-prueba-limpiados")
        );

    } catch (error) {

        console.error("Error en limpieza selectiva:", error);

        mostrarMensaje(
            error.message || "No se pudo realizar la limpieza.",
            "error"
        );

    } finally {

        boton.innerHTML = `
            <i data-lucide="calendar-x"></i>
            Eliminar asistencias de hoy
        `;

        if (window.lucide) window.lucide.createIcons();
    }
}

// =============================================
// EVENTOS DE LIMPIEZA SELECTIVA
// =============================================

function configurarLimpiezaSelectiva() {

    document.getElementById("docente-limpieza")
        ?.addEventListener(
            "change",
            consultarAsistenciasDocenteHoy
        );

    document.getElementById("btn-limpiar-docente")
        ?.addEventListener(
            "click",
            limpiarAsistenciasDocenteHoy
        );

    cargarDocentesLimpieza();
}


iniciarMantenimiento();
