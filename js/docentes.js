
import { supabase } from "./supabase.js";

// =============================================
// MODULO DE GESTION DE DOCENTES
// U.E. TECNICO HUMANISTICO ANTOFAGASTA
// =============================================

const contenedor = document.getElementById("docentes-content");

let docentes = [];
let docenteEditando = null;

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

function mostrarMensaje(mensaje, tipo = "success") {
    const elemento = document.getElementById("docentes-message");

    if (!elemento) return;

    elemento.textContent = mensaje;
    elemento.className = `docentes-message ${tipo}`;
    elemento.classList.remove("hidden");

    setTimeout(() => {
        elemento.classList.add("hidden");
    }, 4000);
}

// =============================================
// INTERFAZ
// =============================================

function renderizarInterfaz() {
    contenedor.innerHTML = `
        <div class="content-card docentes-panel">

            <div class="docentes-toolbar">

                <div class="docentes-search">
                    <i data-lucide="search"></i>

                    <input
                        type="search"
                        id="buscar-docente"
                        placeholder="Buscar por nombre, apellido o CI..."
                    >
                </div>

                <button
                    type="button"
                    class="btn-add"
                    id="nuevo-docente"
                >
                    <i data-lucide="user-plus"></i>
                    Nuevo docente
                </button>

            </div>

            <div id="docentes-message" class="docentes-message hidden"></div>

            <div class="table-responsive">

                <table class="docentes-table">

                    <thead>
                        <tr>
                            <th>NOMBRE COMPLETO</th>
                            <th>CI</th>
                            <th>ESPECIALIDAD</th>
                            <th>CARGO</th>
                            <th>ESTADO</th>
                            <th>ACCIONES</th>
                        </tr>
                    </thead>

                    <tbody id="lista-docentes">
                        <tr>
                            <td colspan="6" class="empty-state">
                                Cargando docentes...
                            </td>
                        </tr>
                    </tbody>

                </table>

            </div>

            <div class="docentes-footer">
                <span id="total-docentes">0 docentes registrados</span>
            </div>

        </div>

        <!-- FORMULARIO MODAL -->

        <div id="modal-docente" class="modal-overlay hidden">

            <div class="modal-docente">

                <div class="modal-header">
                    <div>
                        <h2 id="titulo-formulario">Registrar docente</h2>
                        <p>Complete la información del docente.</p>
                    </div>

                    <button
                        type="button"
                        class="modal-close"
                        id="cerrar-modal"
                        aria-label="Cerrar"
                    >
                        &times;
                    </button>
                </div>

                <form id="form-docente">

                    <div class="docente-form-grid">

                        <div class="form-group">
                            <label for="doc-ci">Cédula de identidad *</label>
                            <input
                                id="doc-ci"
                                type="text"
                                maxlength="20"
                                required
                                placeholder="Ej. 1234567"
                            >
                        </div>

                        <div class="form-group">
                            <label for="doc-nombres">Nombres *</label>
                            <input
                                id="doc-nombres"
                                type="text"
                                maxlength="100"
                                required
                                placeholder="Nombres del docente"
                            >
                        </div>

                        <div class="form-group">
                            <label for="doc-apellidos">Apellidos *</label>
                            <input
                                id="doc-apellidos"
                                type="text"
                                maxlength="100"
                                required
                                placeholder="Apellidos del docente"
                            >
                        </div>

                        <div class="form-group">
                            <label for="doc-especialidad">Especialidad</label>
                            <input
                                id="doc-especialidad"
                                type="text"
                                maxlength="100"
                                placeholder="Ej. Matemáticas"
                            >
                        </div>

                        <div class="form-group">
                            <label for="doc-cargo">Cargo</label>
                            <input
                                id="doc-cargo"
                                type="text"
                                maxlength="100"
                                placeholder="Ej. Docente"
                            >
                        </div>

                        <div class="form-group">
                            <label for="doc-telefono">Teléfono</label>
                            <input
                                id="doc-telefono"
                                type="tel"
                                maxlength="30"
                                placeholder="Número de contacto"
                            >
                        </div>

                        <div class="form-group form-full">
                            <label for="doc-correo">Correo electrónico</label>
                            <input
                                id="doc-correo"
                                type="email"
                                maxlength="150"
                                placeholder="correo@ejemplo.com"
                            >
                        </div>

                    </div>

                    <div class="modal-actions">

                        <button
                            type="button"
                            class="btn-cancel"
                            id="cancelar-docente"
                        >
                            Cancelar
                        </button>

                        <button
                            type="submit"
                            class="btn-save"
                            id="guardar-docente"
                        >
                            <i data-lucide="save"></i>
                            Guardar docente
                        </button>

                    </div>

                </form>

            </div>

        </div>
    `;

    if (window.lucide) {
        window.lucide.createIcons();
    }

    configurarEventos();
}

// =============================================
// CARGAR DOCENTES DESDE SUPABASE
// =============================================

async function cargarDocentes() {
    const tbody = document.getElementById("lista-docentes");

    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="6" class="empty-state">
                Cargando información...
            </td>
        </tr>
    `;

    const { data, error } = await supabase
        .from("docentes")
        .select(`
            id,
            ci,
            nombres,
            apellidos,
            especialidad,
            cargo,
            telefono,
            correo,
            activo,
            created_at
        `)
        .order("apellidos", { ascending: true });

    if (error) {
        console.error("Error cargando docentes:", error);

        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    No se pudo cargar la información.
                </td>
            </tr>
        `;

        mostrarMensaje("Error al consultar los docentes.", "error");
        return;
    }

    docentes = data || [];

    renderizarDocentes(docentes);
    actualizarEstadisticas();
}

// =============================================
// MOSTRAR DOCENTES
// =============================================

function renderizarDocentes(datos) {
    const tbody = document.getElementById("lista-docentes");

    if (!tbody) return;

    if (datos.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    No se encontraron docentes registrados.
                </td>
            </tr>
        `;
    } else {
        tbody.innerHTML = datos.map(docente => `
            <tr>

                <td>
                    <div class="docente-name">
                        <div class="docente-avatar">
                            <i data-lucide="user-round"></i>
                        </div>

                        <strong>
                            ${escaparHTML(docente.apellidos)},
                            ${escaparHTML(docente.nombres)}
                        </strong>
                    </div>
                </td>

                <td>${escaparHTML(docente.ci)}</td>

                <td>${escaparHTML(docente.especialidad || "No especificada")}</td>

                <td>${escaparHTML(docente.cargo || "No especificado")}</td>

                <td>
                    <span class="status-badge ${docente.activo ? "status-active" : "status-inactive"}">
                        ${docente.activo ? "Activo" : "Inactivo"}
                    </span>
                </td>

                <td>
                    <div class="action-buttons">

                        <button
                            type="button"
                            class="action-btn edit-btn"
                            data-action="edit"
                            data-id="${escaparHTML(docente.id)}"
                            title="Editar docente"
                            aria-label="Editar docente"
                        >
                            <i data-lucide="pencil"></i>
                        </button>

                        <button
                            type="button"
                            class="action-btn ${docente.activo ? "deactivate-btn" : "activate-btn"}"
                            data-action="toggle"
                            data-id="${escaparHTML(docente.id)}"
                            title="${docente.activo ? "Desactivar" : "Activar"} docente"
                            aria-label="${docente.activo ? "Desactivar" : "Activar"} docente"
                        >
                            <i data-lucide="${docente.activo ? "user-x" : "user-check"}"></i>
                        </button>

                    </div>
                </td>

            </tr>
        `).join("");
    }

    document.getElementById("total-docentes").textContent =
        `${datos.length} ${datos.length === 1 ? "docente encontrado" : "docentes encontrados"}`;

    if (window.lucide) {
        window.lucide.createIcons();
    }
}

// =============================================
// ACTUALIZAR DASHBOARD
// =============================================

function actualizarEstadisticas() {
    const total = docentes.length;
    const activos = docentes.filter(d => d.activo).length;

    const elemento = document.getElementById("stat-docentes");

    if (elemento) {
        elemento.textContent = activos;
    }

    console.log("Docentes registrados:", total);
    console.log("Docentes activos:", activos);
}

// =============================================
// ABRIR FORMULARIO
// =============================================

function abrirFormulario(docente = null) {
    docenteEditando = docente ? docente.id : null;

    const form = document.getElementById("form-docente");

    form.reset();

    document.getElementById("titulo-formulario").textContent =
        docente ? "Editar docente" : "Registrar docente";

    document.getElementById("guardar-docente").innerHTML =
        `<i data-lucide="save"></i> ${docente ? "Actualizar docente" : "Guardar docente"}`;

    if (docente) {
        document.getElementById("doc-ci").value = docente.ci;
        document.getElementById("doc-nombres").value = docente.nombres;
        document.getElementById("doc-apellidos").value = docente.apellidos;
        document.getElementById("doc-especialidad").value = docente.especialidad || "";
        document.getElementById("doc-cargo").value = docente.cargo || "";
        document.getElementById("doc-telefono").value = docente.telefono || "";
        document.getElementById("doc-correo").value = docente.correo || "";
    }

    document.getElementById("modal-docente").classList.remove("hidden");

    if (window.lucide) {
        window.lucide.createIcons();
    }

    document.getElementById("doc-ci").focus();
}

function cerrarFormulario() {
    document.getElementById("modal-docente").classList.add("hidden");

    document.getElementById("form-docente").reset();

    docenteEditando = null;
}

// =============================================
// GUARDAR DOCENTE
// =============================================

async function guardarDocente(event) {
    event.preventDefault();
    const esEdicion = Boolean(docenteEditando);
    const boton = document.getElementById("guardar-docente");

    const datos = {
        ci: document.getElementById("doc-ci").value.trim(),
        nombres: document.getElementById("doc-nombres").value.trim(),
        apellidos: document.getElementById("doc-apellidos").value.trim(),
        especialidad: document.getElementById("doc-especialidad").value.trim() || null,
        cargo: document.getElementById("doc-cargo").value.trim() || null,
        telefono: document.getElementById("doc-telefono").value.trim() || null,
        correo: document.getElementById("doc-correo").value.trim() || null
    };

    if (!datos.ci || !datos.nombres || !datos.apellidos) {
        mostrarMensaje("Complete los campos obligatorios.", "error");
        return;
    }

    boton.disabled = true;
    boton.textContent = "Guardando...";

    try {
        // Comprobar CI duplicado
        let consulta = supabase
            .from("docentes")
            .select("id")
            .eq("ci", datos.ci);

        if (esEdicion) {
            consulta = consulta.neq("id", docenteEditando);
        }

        const { data: duplicado, error: errorConsulta } =
            await consulta.maybeSingle();

        if (errorConsulta) throw errorConsulta;

        if (duplicado) {
            throw new Error("Ya existe un docente registrado con ese CI.");
        }

        let resultado;

        if (esEdicion) {
            resultado = await supabase
                .from("docentes")
                .update({
                    ...datos,
                    updated_at: new Date().toISOString()
                })
                .eq("id", docenteEditando);
        } else {
            resultado = await supabase
                .from("docentes")
                .insert([datos]);
        }

        if (resultado.error) throw resultado.error;

        cerrarFormulario();

        await cargarDocentes();

        mostrarMensaje(
            esEdicion
                ? "Docente actualizado correctamente."
                : "Docente registrado correctamente."
        );

    } catch (error) {
        console.error("Error guardando docente:", error);

        mostrarMensaje(
            error.message || "No se pudo guardar el docente.",
            "error"
        );

    } finally {
        boton.disabled = false;
        boton.innerHTML = `<i data-lucide="save"></i> Guardar docente`;

        if (window.lucide) {
            window.lucide.createIcons();
        }
    }
}

// =============================================
// EDITAR DOCENTE
// =============================================

function editarDocente(id) {
    const docente = docentes.find(d => d.id === id);

    if (!docente) return;

    abrirFormulario(docente);
}

// =============================================
// ACTIVAR / DESACTIVAR
// =============================================

/*async function cambiarEstadoDocente(id) {
    const docente = docentes.find(d => d.id === id);

    if (!docente) return;

    const nuevoEstado = !docente.activo;

    const accion = nuevoEstado ? "activar" : "desactivar";

    if (!confirm(`¿Está seguro de ${accion} a ${docente.nombres} ${docente.apellidos}?`)) {
        return;
    }

    const { error } = await supabase
        .from("docentes")
        .update({
            activo: nuevoEstado,
            updated_at: new Date().toISOString()
        })
        .eq("id", id);

    if (error) {
        console.error("Error cambiando estado:", error);
        mostrarMensaje("No se pudo actualizar el estado.", "error");
        return;
    }

    await cargarDocentes();

    mostrarMensaje(
        nuevoEstado
            ? "Docente activado correctamente."
            : "Docente desactivado correctamente."
    );
}*/

async function cambiarEstadoDocente(id) {
    const docente = docentes.find(d => d.id === id);

    if (!docente) return;

    const estadoAnterior = docente.activo;
    const nuevoEstado = !estadoAnterior;

    const accion = nuevoEstado ? "activar" : "desactivar";

    if (!confirm(`¿Está seguro de ${accion} a ${docente.nombres} ${docente.apellidos}?`)) {
        return;
    }

    // Actualización visual inmediata
    docente.activo = nuevoEstado;
    renderizarDocentes(docentes);
    actualizarEstadisticas();

    const { error } = await supabase
        .from("docentes")
        .update({
            activo: nuevoEstado,
            updated_at: new Date().toISOString()
        })
        .eq("id", id);

    if (error) {
        // Si falla Supabase, restaurar el estado anterior
        docente.activo = estadoAnterior;

        renderizarDocentes(docentes);
        actualizarEstadisticas();

        console.error("Error cambiando estado:", error);

        mostrarMensaje(
            "No se pudo actualizar el estado. Intente nuevamente.",
            "error"
        );

        return;
    }

    mostrarMensaje(
        nuevoEstado
            ? "Docente activado correctamente."
            : "Docente desactivado correctamente."
    );
}

// =============================================
// BUSQUEDA
// =============================================

function buscarDocente(termino) {
    const texto = termino.toLowerCase().trim();

    const resultado = docentes.filter(docente => {
        const nombre = `${docente.nombres} ${docente.apellidos}`.toLowerCase();

        return (
            nombre.includes(texto) ||
            docente.ci.toLowerCase().includes(texto) ||
            (docente.especialidad || "").toLowerCase().includes(texto)
        );
    });

    renderizarDocentes(resultado);
}

// =============================================
// EVENTOS
// =============================================

function configurarEventos() {
    document.getElementById("nuevo-docente")
        .addEventListener("click", () => abrirFormulario());

    document.getElementById("cerrar-modal")
        .addEventListener("click", cerrarFormulario);

    document.getElementById("cancelar-docente")
        .addEventListener("click", cerrarFormulario);

    document.getElementById("form-docente")
        .addEventListener("submit", guardarDocente);

    document.getElementById("buscar-docente")
        .addEventListener("input", event => {
            buscarDocente(event.target.value);
        });

    document.getElementById("lista-docentes")
        .addEventListener("click", event => {
            const boton = event.target.closest("[data-action]");

            if (!boton) return;

            const id = boton.dataset.id;

            if (boton.dataset.action === "edit") {
                editarDocente(id);
            }

            if (boton.dataset.action === "toggle") {
                cambiarEstadoDocente(id);
            }
        });

    document.getElementById("modal-docente")
        .addEventListener("click", event => {
            if (event.target.id === "modal-docente") {
                cerrarFormulario();
            }
        });
}

// =============================================
// INICIALIZACION
// =============================================

renderizarInterfaz();

// Cargar cuando se abre la sección Docentes
document.querySelector('[data-page="docentes"]')
    .addEventListener("click", cargarDocentes);
