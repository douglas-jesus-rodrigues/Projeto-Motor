const usuario = JSON.parse(localStorage.getItem("usuario"));

if (!usuario) {
    window.location.href = "/pages/login.html";
}

const nomeUsuario = document.getElementById("nomeUsuario");
const btnSair = document.getElementById("btnSair");

if (usuario && nomeUsuario) {
    nomeUsuario.textContent = `Bem-vindo, ${usuario.nome}`;
}

btnSair.addEventListener("click", function(event){
    event.preventDefault();

    localStorage.removeItem("usuario");
    window.location.href = "/pages/login.html";
});