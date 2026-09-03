const multer = require("multer");
const path = require("path");

// Configuração de armazenamento corrigida para encontrar a pasta public/uploads na raiz
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Como o multer está em src/middlewares/, precisamos subir dois níveis para alcançar a pasta public na raiz
        cb(null, path.join(__dirname, "../../public/uploads"));
    },
    filename: function (req, file, cb) {
        // Gera um nome único baseado na data atual + ID aleatório + extensão original
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

module.exports = upload;