
import { supabase } from "./supabase.js";

// ELEMENTOS PRINCIPALES
const loginScreen = document.getElementById("login-screen");
const app = document.getElementById("app");
const loginForm = document.getElementById("login-form");
const loginMessage = document.getElementById("login-message");
const loginButton = loginForm.querySelector('button[type="submit"]');

const adminName = document.getElementById("admin-name");
const logoutButton = document.getElementById("logout-button");

// MOSTRAR MENSAJES
function mostrarMensaje(mensaje, error = true) {
    loginMessage.textContent = mensaje;
    loginMessage.style.color = error ? "#dc5454" : "#15966a";
}

// MOSTRAR LOGIN
function mostrarLogin() {
    loginScreen.classList.remove("hidden");
    app.classList.add("hidden");
}

// MOSTRAR PANEL
function mostrarPanel(nombre) {
    loginScreen.classList.add("hidden");
    app.classList.remove("hidden");

    adminName.textContent = nombre || "Administrador";

    actualizarFecha();

    if (window.lucide) {
        window.lucide.createIcons();
    }
}

// VERIFICAR PERMISOS DEL ADMINISTRADOR
async function verificarAdministrador(user) {
    if (!user) {
        mostrarLogin();
        return false;
    }

    const { data: perfil, error } = await supabase
        .from("perfiles")
        .select("nombre_completo, rol, activo")
        .eq("id", user.id)
        .maybeSingle();

    if (error) {
        console.error("Error consultando perfil:", error);
        mostrarLogin();
        return false;
    }

    if (!perfil || perfil.rol !== "admin" || !perfil.activo) {
        await supabase.auth.signOut();

        mostrarMensaje(
            "Tu cuenta no tiene permisos de administrador."
        );

        mostrarLogin();
        return false;
    }

    mostrarPanel(perfil.nombre_completo);
    return true;
}

// INICIAR SESION
loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document
        .getElementById("login-email")
        .value.trim();

    const password = document
        .getElementById("login-password")
        .value;

    loginButton.disabled = true;
    loginButton.textContent = "Verificando...";
    mostrarMensaje("", false);

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            throw error;
        }

        const autorizado = await verificarAdministrador(data.user);

        if (!autorizado) {
            throw new Error(
                "No se pudo validar el acceso administrativo."
            );
        }

        loginForm.reset();

    } catch (error) {
        console.error("Error de acceso:", error);

        mostrarLogin();

        mostrarMensaje(
            error.message === "Invalid login credentials"
                ? "Correo o contraseña incorrectos."
                : error.message
        );

    } finally {
        loginButton.disabled = false;
        loginButton.textContent = "Iniciar sesión";
    }
});

// CERRAR SESION
logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;

    try {
        const { error } = await supabase.auth.signOut();

        if (error) throw error;

        mostrarLogin();

    } catch (error) {
        console.error("Error al cerrar sesión:", error);
        alert("No se pudo cerrar la sesión.");

    } finally {
        logoutButton.disabled = false;
    }
});

// RECUPERAR SESION AL RECARGAR
async function iniciarAplicacion() {
    try {
        const { data, error } = await supabase.auth.getSession();

        if (error) throw error;

        if (data.session) {
            await verificarAdministrador(data.session.user);
        } else {
            mostrarLogin();
        }

    } catch (error) {
        console.error("Error recuperando sesión:", error);
        mostrarLogin();
    }
}

// ESCUCHAR CAMBIOS DE AUTENTICACION
supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") {
        mostrarLogin();
    }
});

// FECHA DEL SISTEMA
function actualizarFecha() {
    const elemento = document.getElementById("current-date");

    if (!elemento) return;

    elemento.textContent = new Intl.DateTimeFormat("es-BO", {
        dateStyle: "full",
        timeZone: "America/La_Paz"
    }).format(new Date());
}

// NAVEGACION DEL MENU
document.querySelectorAll(".nav-item").forEach((boton) => {
    boton.addEventListener("click", () => {
        const pagina = boton.dataset.page;

        document.querySelectorAll(".nav-item").forEach((item) => {
            item.classList.remove("active");
        });

        boton.classList.add("active");

        document.querySelectorAll(".page").forEach((seccion) => {
            seccion.classList.remove("active");
        });

        const destino = document.getElementById(`page-${pagina}`);

        if (destino) {
            destino.classList.add("active");
        }

        document.getElementById("sidebar").classList.remove("open");
    });
});

// MENU MOVIL
document.getElementById("menu-toggle").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("open");
});

// INICIAR
iniciarAplicacion();
