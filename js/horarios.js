
import { supabase } from "./supabase.js";

// =============================================
// HORARIO INSTITUCIONAL
// U.E. TECNICO HUMANISTICO ANTOFAGASTA
// =============================================

const contenedor = document.getElementById("horarios-content");

const DIAS_LABORALES = [1, 2, 3, 4, 5];

let configuracion = {
    hora_entrada: "08:00",
    hora_salida: "13:40",
    tolerancia_minutos: 10
};

let guardando = false;

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
        <div class="horarios-dashboard">

            <div class="horarios-resumen">
                <div class="horario-stat">
                    <span>Días laborales</span>
                    <strong>5</strong>
                </div>

                <div class="horario-stat">
                    <span>Docentes activos</span>
                    <strong id="resumen-docentes">0</strong>
                </div>

                <div class="horario-stat">
                    <span>Tolerancia</span>
                    <strong id="resumen-tolerancia">10 min</strong>
                </div>
            </div>

            <div class="content-card horario-form-card">

                <div class="horario-card-heading">
                    <div>
                        <h2>Configuración de horario institucional</h2>
                        <p>
                            El horario se aplicará a todos los docentes activos.
                        </p>
                    </div>
                </div>

                <form id="form-horario-institucional">

                    <div class="horario-form-grid">

                        <div class="form-group">
                            <label for="hora-entrada">
                                Hora de entrada
                            </label>

                            <input
                                type="time"
                                id="hora-entrada"
                                value="08:00"
                                required
                            >
                        </div>

                        <div class="form-group">
                            <label for="hora-salida">
                                Hora de salida
                            </label>

                            <input
                                type="time"
                                id="hora-salida"
                                value="13:40"
                                required
                            >
                        </div>

                        <div class="form-group">
                            <label for="tolerancia-minutos">
                                Tolerancia de entrada (minutos)
                            </label>

                            <input
                                type="number"
                                id="tolerancia-minutos"
                                min="0"
                                max="120"
                                value="10"
                                required
                            >
                        </div>

                    </div>

                    <div class="horario-dias">
                        <label>Días de aplicación</label>

                        <div class="dias-laborales">
                            ${[
                                "Lunes",
                                "Martes",
                                "Miércoles",
                                "Jueves",
                                "Viernes"
                            ].map(dia => `
                                <span class="dia-laboral">
                                    <i data-lucide="check-circle"></i>
                                    ${dia}
                                </span>
                            `).join("")}
                        </div>

                        <p>
                            Sábados y domingos no tienen horario institucional.
                        </p>
                    </div>

                    <div class="horario-info">
                        <i data-lucide="users"></i>

                        <div>
                            <strong>Aplicación general</strong>
                            <p>
                                Se actualizará el horario de todos los docentes
                                activos y se crearán los días que falten.
                            </p>
                        </div>
                    </div>

                    <div id="mensaje-horario" class="horario-message hidden"></div>

                    <div class="horario-form-actions">
                        <button
                            type="submit"
                            id="guardar-horario"
                            class="btn-save"
                        >
                            <i data-lucide="save"></i>
                            Guardar horario institucional
                        </button>
                    </div>

                </form>
            </div>

            <div class="content-card horarios-list-card">
                <div class="horario-list-heading">
                    <div>
                        <h2>Horario aplicado</h2>
                        <p>Resumen de la configuración institucional.</p>
                    </div>

                    <button
                        type="button"
                        id="recargar-horarios"
                        class="btn-refresh"
                    >
                        <i data-lucide="refresh-cw"></i>
                        Actualizar
                    </button>
                </div>

                <div class="table-responsive">
                    <table class="docentes-table">
                        <thead>
                            <tr>
                                <th>DÍA</th>
                                <th>ENTRADA</th>
                                <th>SALIDA</th>
                                <th>TOLERANCIA</th>
                                <th>ESTADO</th>
                            </tr>
                        </thead>

                        <tbody id="lista-horarios">
                            <tr>
                                <td colspan="5" class="empty-state">
                                    Cargando configuración...
                                </td>
                            </tr>
                        </tbody>
                    </table>
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
// CARGAR CONFIGURACION EXISTENTE
// =============================================

async function cargarHorarios() {
    try {
        const [resultadoHorarios, resultadoDocentes] =
            await Promise.all([

                supabase
                    .from("horarios")
                    .select(`
                        id,
                        docente_id,
                        dia_semana,
                        hora_entrada,
                        hora_salida,
                        tolerancia_minutos,
                        activo
                    `)
                    .in("dia_semana", DIAS_LABORALES)
                    .eq("activo", true)
                    .order("dia_semana"),

                supabase
                    .from("docentes")
                    .select("id", { count: "exact", head: true })
                    .eq("activo", true)

            ]);

        if (resultadoHorarios.error) {
            throw resultadoHorarios.error;
        }

        if (resultadoDocentes.error) {
            throw resultadoDocentes.error;
        }

        const horarios = resultadoHorarios.data || [];

        const totalDocentes = resultadoDocentes.count || 0;

        document.getElementById("resumen-docentes").textContent =
            totalDocentes;

        if (horarios.length > 0) {

            // Tomar la configuración del primer día laboral
            const referencia = horarios[0];

            configuracion = {
                hora_entrada: referencia.hora_entrada.substring(0, 5),
                hora_salida: referencia.hora_salida.substring(0, 5),
                tolerancia_minutos: referencia.tolerancia_minutos
            };

            document.getElementById("hora-entrada").value =
                configuracion.hora_entrada;

            document.getElementById("hora-salida").value =
                configuracion.hora_salida;

            document.getElementById("tolerancia-minutos").value =
                configuracion.tolerancia_minutos;
        }

        document.getElementById("resumen-tolerancia").textContent =
            `${configuracion.tolerancia_minutos} min`;

        renderizarTabla(horarios);

    } catch (error) {

        console.error("Error cargando horario institucional:", error);

        mostrarMensaje(
            "No se pudo consultar la configuración: " + error.message,
            "error"
        );
    }
}

// =============================================
// MOSTRAR TABLA
// =============================================

function renderizarTabla(horarios) {

    const tbody = document.getElementById("lista-horarios");

    const nombresDias = [
        "Domingo",
        "Lunes",
        "Martes",
        "Miércoles",
        "Jueves",
        "Viernes",
        "Sábado"
    ];

    const porDia = new Map();

    horarios.forEach(h => {
        if (!porDia.has(h.dia_semana)) {
            porDia.set(h.dia_semana, h);
        }
    });

    tbody.innerHTML = DIAS_LABORALES.map(dia => {

        const horario = porDia.get(dia);

        if (!horario) {
            return `
                <tr>
                    <td>${nombresDias[dia]}</td>
                    <td colspan="3">Sin configurar</td>
                    <td><span class="status-badge status-inactive">Inactivo</span></td>
                </tr>
            `;
        }

        return `
            <tr>
                <td><strong>${nombresDias[dia]}</strong></td>
                <td>${escaparHTML(horario.hora_entrada.substring(0, 5))}</td>
                <td>${escaparHTML(horario.hora_salida.substring(0, 5))}</td>
                <td>${Number(horario.tolerancia_minutos)} minutos</td>
                <td>
                    <span class="status-badge status-active">
                        Activo
                    </span>
                </td>
            </tr>
        `;

    }).join("");
}

// =============================================
// GUARDAR HORARIO PARA TODOS
// =============================================

async function guardarHorarioInstitucional(event) {

    event.preventDefault();

    if (guardando) return;

    const entrada = document.getElementById("hora-entrada").value;
    const salida = document.getElementById("hora-salida").value;

    const tolerancia = Number(
        document.getElementById("tolerancia-minutos").value
    );

    if (!entrada || !salida || entrada >= salida) {
        mostrarMensaje(
            "La hora de salida debe ser posterior a la entrada.",
            "error"
        );
        return;
    }

    if (!Number.isInteger(tolerancia) ||
        tolerancia < 0 ||
        tolerancia > 120) {

        mostrarMensaje(
            "La tolerancia debe estar entre 0 y 120 minutos.",
            "error"
        );
        return;
    }

    const confirmar = confirm(
        "¿Aplicar este horario a todos los docentes activos, " +
        "de lunes a viernes?"
    );

    if (!confirmar) return;

    guardando = true;

    const boton = document.getElementById("guardar-horario");

    boton.disabled = true;
    boton.textContent = "Aplicando horario...";

    try {

        const { data: listaDocentes, error: errorDocentes } =
            await supabase
                .from("docentes")
                .select("id")
                .eq("activo", true);

        if (errorDocentes) throw errorDocentes;

        if (!listaDocentes?.length) {
            throw new Error("No hay docentes activos registrados.");
        }

        const { data: existentes, error: errorExistentes } =
            await supabase
                .from("horarios")
                .select("id, docente_id, dia_semana")
                .in("dia_semana", DIAS_LABORALES);

        if (errorExistentes) throw errorExistentes;

        const valores = [];

        for (const docente of listaDocentes) {

            for (const dia of DIAS_LABORALES) {

                const encontrado = existentes.find(h =>
                    h.docente_id === docente.id &&
                    h.dia_semana === dia
                );

                const datos = {
                    hora_entrada: entrada,
                    hora_salida: salida,
                    tolerancia_minutos: tolerancia,
                    activo: true
                };

                if (encontrado) {

                    const { error } = await supabase
                        .from("horarios")
                        .update(datos)
                        .eq("docente_id", docente.id)
                        .eq("dia_semana", dia);

                    if (error) throw error;

                } else {

                    valores.push({
                        docente_id: docente.id,
                        dia_semana: dia,
                        ...datos
                    });
                }
            }
        }

        // Crear todos los horarios faltantes
        if (valores.length > 0) {

            const { error } = await supabase
                .from("horarios")
                .insert(valores);

            if (error) throw error;
        }

        // Desactivar horarios de fin de semana
        const { error: errorFinSemana } = await supabase
            .from("horarios")
            .update({ activo: false })
            .in("dia_semana", [0, 6]);

        if (errorFinSemana) throw errorFinSemana;

        configuracion = {
            hora_entrada: entrada,
            hora_salida: salida,
            tolerancia_minutos: tolerancia
        };

        mostrarMensaje(
            `Horario aplicado correctamente a ${listaDocentes.length} docentes.`,
            "success"
        );

        await cargarHorarios();

    } catch (error) {

        console.error("Error aplicando horario:", error);

        mostrarMensaje(
            "No se pudo completar la actualización: " + error.message,
            "error"
        );

        await cargarHorarios();

    } finally {

        guardando = false;

        boton.disabled = false;

        boton.innerHTML = `
            <i data-lucide="save"></i>
            Guardar horario institucional
        `;

        if (window.lucide) {
            window.lucide.createIcons();
        }
    }
}

// =============================================
// MENSAJES
// =============================================

function mostrarMensaje(mensaje, tipo) {

    const elemento = document.getElementById("mensaje-horario");

    if (!elemento) return;

    elemento.textContent = mensaje;
    elemento.className = `horario-message ${tipo}`;

    elemento.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
    });
}

// =============================================
// EVENTOS
// =============================================

function configurarEventos() {

    document.getElementById("form-horario-institucional")
        .addEventListener("submit", guardarHorarioInstitucional);

    document.getElementById("recargar-horarios")
        .addEventListener("click", cargarHorarios);
}

// =============================================
// INICIAR MODULO
// =============================================

function iniciarModuloHorarios() {

    if (!contenedor) {
        console.error("No se encontró horarios-content");
        return;
    }

    renderizarInterfaz();

    cargarHorarios();

    document.querySelector('[data-page="horarios"]')
        ?.addEventListener("click", cargarHorarios);
}

iniciarModuloHorarios();
